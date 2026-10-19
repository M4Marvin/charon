import { and, desc, eq, inArray } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  generationJobs,
  generationProposals,
  chatMessageRevisions,
  type GenerationJob,
  type GenerationProposal,
} from "@/db/schema";
import {
  ChatBusyError,
  LeaseLostError,
  type GenerationError,
} from "@/features/generation/errors";
import type { InsertionTarget, PromptMode, Trigger } from "@/features/generation/contract";

const ACTIVE_STATUSES = ["queued", "running", "finalizing"] as const;

export interface CreateGenerationJobInput {
  requestId: string;
  chatId: string;
  trigger: Trigger;
  promptMode: PromptMode;
  baseLeafId: number;
  target?: InsertionTarget;
  input?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  placeholderLocalId?: number | null;
}

export function getJob(jobId: string, db: DB = defaultDb): GenerationJob | undefined {
  return db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).get();
}

export function getJobByRequestId(requestId: string, db: DB = defaultDb): GenerationJob | undefined {
  return db.select().from(generationJobs).where(eq(generationJobs.requestId, requestId)).get();
}

export function getActiveJob(chatId: string, db: DB = defaultDb): GenerationJob | undefined {
  return db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.chatId, chatId),
        inArray(generationJobs.status, [...ACTIVE_STATUSES]),
      ),
    )
    .get();
}

export function listRecentJobs(chatId: string, db: DB = defaultDb, limit = 20): GenerationJob[] {
  return db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.chatId, chatId))
    .orderBy(desc(generationJobs.createdAt))
    .limit(limit)
    .all();
}

/**
 * Idempotent job creation plus the one-active-job gate. better-sqlite3
 * transactions are synchronous; the partial unique index is the final guard.
 */
export function createJob(
  input: CreateGenerationJobInput,
  db: DB = defaultDb,
): GenerationJob {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.requestId, input.requestId))
      .get();
    if (existing) return existing;

    const active = tx
      .select()
      .from(generationJobs)
      .where(
        and(
          eq(generationJobs.chatId, input.chatId),
          inArray(generationJobs.status, [...ACTIVE_STATUSES]),
        ),
      )
      .get();
    if (active) {
      throw new ChatBusyError({
        message: "A generation is already running in this chat.",
        chatId: input.chatId,
        activeJobId: active.id,
      });
    }

    const row = tx
      .insert(generationJobs)
      .values({
        requestId: input.requestId,
        chatId: input.chatId,
        trigger: input.trigger,
        promptMode: input.promptMode,
        status: "queued",
        baseLeafId: input.baseLeafId,
        target: input.target as unknown as Record<string, unknown> | undefined,
        input: input.input,
        placeholderLocalId: input.placeholderLocalId ?? null,
        requiresConfirmation: input.requiresConfirmation ?? false,
        createdAt: new Date(),
      })
      .returning()
      .get();
    if (!row) throw new Error("Failed to create generation job");
    return row;
  });
}

export function setJobPlaceholder(
  jobId: string,
  placeholderLocalId: number,
  baseLeafId: number,
  db: DB = defaultDb,
): void {
  db.update(generationJobs)
    .set({ placeholderLocalId, baseLeafId })
    .where(eq(generationJobs.id, jobId))
    .run();
}

export interface LeaseInput {
  jobId: string;
  owner: string;
  ttlMs?: number;
}

export function beginJob(input: LeaseInput, db: DB = defaultDb): GenerationJob {
  const now = new Date();
  const expires = new Date(now.getTime() + (input.ttlMs ?? 120_000));
  const row = db
    .update(generationJobs)
    .set({
      status: "running",
      leaseOwner: input.owner,
      leaseEpoch: (getJob(input.jobId, db)?.leaseEpoch ?? 0) + 1,
      leaseExpiresAt: expires,
      startedAt: now,
      attempt: (getJob(input.jobId, db)?.attempt ?? 0) + 1,
    })
    .where(
      and(
        eq(generationJobs.id, input.jobId),
        inArray(generationJobs.status, ["queued", "running"]),
      ),
    )
    .returning()
    .get();
  if (!row) {
    throw new LeaseLostError({ message: "Could not acquire generation lease.", jobId: input.jobId });
  }
  return row;
}

export function heartbeatJob(input: LeaseInput, db: DB = defaultDb): void {
  const expires = new Date(Date.now() + (input.ttlMs ?? 120_000));
  db.update(generationJobs)
    .set({ leaseExpiresAt: expires })
    .where(
      and(
        eq(generationJobs.id, input.jobId),
        eq(generationJobs.leaseOwner, input.owner),
        eq(generationJobs.status, "running"),
      ),
    )
    .run();
}

export function updateDraft(
  jobId: string,
  text: string,
  seq: number,
  db: DB = defaultDb,
): void {
  db.update(generationJobs)
    .set({ draftText: text.slice(-64_000), chunkSeq: seq })
    .where(eq(generationJobs.id, jobId))
    .run();
}

export interface FinalizeJobInput {
  jobId: string;
  owner: string;
  epoch: number;
  result: Record<string, unknown>;
  usage?: Record<string, unknown> | null;
  finishReason?: string | null;
}

export function finalizeJob(input: FinalizeJobInput, db: DB = defaultDb): boolean {
  const row = db
    .update(generationJobs)
    .set({
      status: "succeeded",
      result: input.result,
      usage: input.usage ?? null,
      finishReason: input.finishReason ?? null,
      finishedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(generationJobs.id, input.jobId),
        eq(generationJobs.leaseOwner, input.owner),
        eq(generationJobs.leaseEpoch, input.epoch),
        inArray(generationJobs.status, ["running", "finalizing"]),
      ),
    )
    .returning()
    .get();
  return Boolean(row);
}

export interface FailJobInput {
  jobId: string;
  owner?: string;
  code: string;
  message: string;
  usage?: Record<string, unknown> | null;
  finishReason?: string | null;
}

export function failJob(input: FailJobInput, db: DB = defaultDb): boolean {
  const where = input.owner
    ? and(eq(generationJobs.id, input.jobId), eq(generationJobs.leaseOwner, input.owner))
    : eq(generationJobs.id, input.jobId);
  const row = db
    .update(generationJobs)
    .set({
      status: "failed",
      error: { code: input.code, message: input.message },
      usage: input.usage ?? null,
      finishReason: input.finishReason ?? null,
      finishedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(where)
    .returning()
    .get();
  return Boolean(row);
}

export function cancelJob(jobId: string, db: DB = defaultDb): boolean {
  const row = db
    .update(generationJobs)
    .set({
      status: "cancelled",
      finishedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(and(eq(generationJobs.id, jobId), inArray(generationJobs.status, ["queued", "running"])))
    .returning()
    .get();
  return Boolean(row);
}

export function createProposal(
  input: {
    jobId: string;
    chatId: string;
    kind: "rewrite" | "transform" | "impersonate" | "image";
    targetLocalId?: number | null;
    baseRev?: number | null;
    baseHash?: string | null;
    proposedContent: string;
    proposedRole?: "user" | "assistant" | null;
    meta?: Record<string, unknown>;
  },
  db: DB = defaultDb,
): GenerationProposal {
  const row = db
    .insert(generationProposals)
    .values({
      jobId: input.jobId,
      chatId: input.chatId,
      kind: input.kind,
      status: "pending",
      targetLocalId: input.targetLocalId ?? null,
      baseRev: input.baseRev ?? null,
      baseHash: input.baseHash ?? null,
      proposedContent: input.proposedContent,
      proposedRole: input.proposedRole ?? null,
      meta: input.meta,
      createdAt: new Date(),
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create proposal");
  return row;
}

export function getProposal(id: string, db: DB = defaultDb): GenerationProposal | undefined {
  return db.select().from(generationProposals).where(eq(generationProposals.id, id)).get();
}

export function listPendingProposals(chatId: string, db: DB = defaultDb): GenerationProposal[] {
  return db
    .select()
    .from(generationProposals)
    .where(
      and(eq(generationProposals.chatId, chatId), eq(generationProposals.status, "pending")),
    )
    .orderBy(desc(generationProposals.createdAt))
    .all();
}

export function resolveProposal(
  id: string,
  status: "accepted" | "rejected" | "superseded",
  db: DB = defaultDb,
): GenerationProposal | undefined {
  return db
    .update(generationProposals)
    .set({ status, resolvedAt: new Date() })
    .where(and(eq(generationProposals.id, id), eq(generationProposals.status, "pending")))
    .returning()
    .get();
}

export function insertRevision(
  input: {
    chatId: string;
    messageLocalId: number;
    rev: number;
    content: string;
    source: "edit" | "rewrite" | "undo";
    jobId?: string | null;
  },
  db: DB = defaultDb,
): void {
  db.insert(chatMessageRevisions).values(input).run();
}

export function getRevisions(chatId: string, messageLocalId: number, db: DB = defaultDb) {
  return db
    .select()
    .from(chatMessageRevisions)
    .where(
      and(
        eq(chatMessageRevisions.chatId, chatId),
        eq(chatMessageRevisions.messageLocalId, messageLocalId),
      ),
    )
    .orderBy(desc(chatMessageRevisions.rev))
    .all();
}

export function generationErrorToBody(error: GenerationError): { code: string; message: string } {
  return { code: error._tag, message: error.message };
}
