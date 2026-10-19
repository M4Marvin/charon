import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import {
  generationJobs,
  generationProposals,
  type GenerationJob,
  type GenerationProposal,
} from "@/db/schema";
import { ChatBusyError, LeaseLostError } from "@/features/generation/errors";
import type { InsertionTarget, PromptMode, Trigger } from "@/features/generation/contract";

const ACTIVE_STATUSES = ["queued", "running", "finalizing"] as const;

/** A prepared job that never reached the stream endpoint must not wedge a chat. */
export const QUEUED_JOB_TTL_MS = 2 * 60_000;

export interface CreateGenerationJobInput {
  chatId: string;
  trigger: Trigger;
  promptMode: PromptMode;
  target?: InsertionTarget;
  input?: Record<string, unknown>;
  placeholderLocalId?: number | null;
}

export function getJob(jobId: string, db: DB = defaultDb): GenerationJob | undefined {
  return db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).get();
}

function isStaleActiveJob(job: GenerationJob, now: number): boolean {
  const deadline = job.leaseExpiresAt?.getTime() ?? job.createdAt.getTime() + QUEUED_JOB_TTL_MS;
  return deadline <= now;
}

/**
 * Job creation plus the one-active-job gate. The caller must own the
 * transaction so the job and its messages commit or roll back together; the
 * partial unique index is the final guard.
 */
export function createJobInTransaction(input: CreateGenerationJobInput, db: DB): GenerationJob {
  let active = db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.chatId, input.chatId),
        inArray(generationJobs.status, [...ACTIVE_STATUSES]),
      ),
    )
    .get();
  if (active && isStaleActiveJob(active, Date.now())) {
    db.update(generationJobs)
      .set({
        status: "expired",
        error: {
          code: "job_expired",
          message: "The generation job expired before it could start.",
        },
        finishedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      .where(eq(generationJobs.id, active.id))
      .run();
    active = undefined;
  }
  if (active) {
    throw new ChatBusyError({
      message: "A generation is already running in this chat.",
      chatId: input.chatId,
      activeJobId: active.id,
    });
  }

  const row = db
    .insert(generationJobs)
    .values({
      chatId: input.chatId,
      trigger: input.trigger,
      promptMode: input.promptMode,
      status: "queued",
      target: input.target as unknown as Record<string, unknown> | undefined,
      input: input.input,
      placeholderLocalId: input.placeholderLocalId ?? null,
      createdAt: new Date(),
    })
    .returning()
    .get();
  if (!row) throw new Error("Failed to create generation job");
  return row;
}

export function setJobPlaceholder(
  jobId: string,
  placeholderLocalId: number,
  db: DB = defaultDb,
): void {
  db.update(generationJobs).set({ placeholderLocalId }).where(eq(generationJobs.id, jobId)).run();
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
      leaseEpoch: sql`${generationJobs.leaseEpoch} + 1`,
      leaseExpiresAt: expires,
      startedAt: now,
    })
    .where(
      and(
        eq(generationJobs.id, input.jobId),
        or(
          eq(generationJobs.status, "queued"),
          and(eq(generationJobs.status, "running"), lte(generationJobs.leaseExpiresAt, now)),
        ),
      ),
    )
    .returning()
    .get();
  if (!row) {
    throw new LeaseLostError({
      message: "Could not acquire generation lease.",
      jobId: input.jobId,
    });
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
    ? and(
        eq(generationJobs.id, input.jobId),
        eq(generationJobs.leaseOwner, input.owner),
        inArray(generationJobs.status, ["queued", "running", "finalizing"]),
      )
    : and(
        eq(generationJobs.id, input.jobId),
        inArray(generationJobs.status, ["queued", "running", "finalizing"]),
      );
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

export function resolveProposal(
  id: string,
  status: "accepted" | "rejected",
  db: DB = defaultDb,
): GenerationProposal | undefined {
  return db
    .update(generationProposals)
    .set({ status, resolvedAt: new Date() })
    .where(and(eq(generationProposals.id, id), eq(generationProposals.status, "pending")))
    .returning()
    .get();
}
