import {
  isRunStatus,
  type ModelMessage,
  type RunError,
  type RunRecord,
  type TokenUsage,
} from "@tanstack/ai";
import {
  defineInterruptStore,
  defineMessageStore,
  defineMetadataStore,
  defineRunStore,
  type ChatPersistence,
  type InterruptCommitEntry,
  type InterruptRecord,
  type RunStore,
} from "@tanstack/ai-persistence";
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import { Data } from "effect";
import type { DB } from "@/db";
import {
  aiChatThreads,
  aiInterrupts,
  aiMetadata,
  aiRuns,
  type AiInterrupt,
  type AiRun,
} from "@/db/schema";

/**
 * Raised when a persisted row violates the TanStack contract at read time.
 * Effect's tagged errors give callers a stable `_tag` to switch on without
 * coupling this adapter to the rest of the generation engine's error union.
 */
export class PersistenceRowError extends Data.TaggedError("PersistenceRowError")<{
  readonly message: string;
  readonly store: "runs";
  readonly id: string;
}> {}

type CreateRunInput = Parameters<RunStore["createOrResume"]>[0];
type RunPatch = Parameters<RunStore["update"]>[1];
type DbTransaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Serialize a TanStack promise-returning store method over synchronous SQLite calls. */
function fromSync<T>(operation: () => T): Promise<T> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/** JSON storage turns ModelMessage.createdAt into an ISO string; restore its Date type. */
function toModelMessages(value: Array<unknown>): Array<ModelMessage> {
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object") return entry as ModelMessage;
    const message = entry as Record<string, unknown>;
    const createdAt = message.createdAt;
    if (typeof createdAt === "string" || typeof createdAt === "number") {
      const parsed = new Date(createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        return { ...message, createdAt: parsed } as unknown as ModelMessage;
      }
    }
    return message as unknown as ModelMessage;
  });
}

function toRunRecord(row: AiRun): RunRecord {
  if (!isRunStatus(row.status)) {
    // The readers downstream act destructively on a status, so never hand out
    // an unvalidated column value (see run-store.d.ts's isRunStatus docs).
    throw new PersistenceRowError({
      message: `Stored run ${row.runId} has an invalid status: ${String(row.status)}`,
      store: "runs",
      id: row.runId,
    });
  }

  const record: RunRecord = {
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    startedAt: row.startedAt.getTime(),
  };
  if (row.parentRunId !== null) record.parentRunId = row.parentRunId;
  if (row.subagentRunId !== null) record.subagentRunId = row.subagentRunId;
  if (row.name !== null) record.name = row.name;
  if (row.finishedAt !== null) record.finishedAt = row.finishedAt.getTime();
  if (row.error !== null) record.error = row.error as unknown as RunError;
  if (row.usage !== null) record.usage = row.usage as unknown as TokenUsage;
  if (row.detachedSince !== null) record.detachedSince = row.detachedSince.getTime();
  if (row.cancelRequested) record.cancelRequested = true;
  if (row.driverEpoch !== null) record.driverEpoch = row.driverEpoch;
  return record;
}

function toInterruptRecord(row: AiInterrupt): InterruptRecord {
  const record: InterruptRecord = {
    interruptId: row.interruptId,
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    requestedAt: row.requestedAt.getTime(),
    payload: row.payload ?? {},
  };
  if (row.resolvedAt !== null) record.resolvedAt = row.resolvedAt.getTime();
  if (row.response !== null) record.response = row.response;
  return record;
}

/**
 * Map a contract patch onto an `ai_runs` update set. An explicitly present
 * `undefined` clears the column to NULL, matching the in-memory reference
 * (e.g. `update(id, { detachedSince: undefined })` reattaches a run).
 */
function runUpdateSet(patch: RunPatch): Partial<typeof aiRuns.$inferInsert> {
  const values: Partial<typeof aiRuns.$inferInsert> = {};
  if (hasOwn(patch, "status") && patch.status !== undefined) values.status = patch.status;
  if (hasOwn(patch, "finishedAt")) {
    values.finishedAt = patch.finishedAt === undefined ? null : new Date(patch.finishedAt);
  }
  if (hasOwn(patch, "error")) {
    values.error =
      patch.error === undefined ? null : (patch.error as unknown as Record<string, unknown>);
  }
  if (hasOwn(patch, "usage")) {
    values.usage =
      patch.usage === undefined ? null : (patch.usage as unknown as Record<string, unknown>);
  }
  if (hasOwn(patch, "detachedSince")) {
    values.detachedSince = patch.detachedSince === undefined ? null : new Date(patch.detachedSince);
  }
  if (hasOwn(patch, "cancelRequested")) {
    values.cancelRequested = patch.cancelRequested ?? false;
  }
  if (hasOwn(patch, "driverEpoch")) {
    values.driverEpoch = patch.driverEpoch ?? null;
  }
  // `sandboxKey` has no ai_runs column in this schema; it is intentionally
  // dropped here and reported as an integration gap.
  return values;
}

// ── Metadata revisions ───────────────────────────────────────────────────────
// Revisions are opaque strings to TanStack but stored as INTEGER. A reserved
// row keeps a global counter so a deleted key's revision is never reissued,
// matching the in-memory reference store's monotonic counter.

const REVISION_NAMESPACE = "\u0000tanstack-ai-metadata-revision";
const REVISION_KEY = "counter";

function revisionWhere(): ReturnType<typeof and> {
  return and(eq(aiMetadata.namespace, REVISION_NAMESPACE), eq(aiMetadata.key, REVISION_KEY));
}

function nextRevision(tx: DbTransaction): number {
  const counter = tx
    .select({ revision: aiMetadata.revision })
    .from(aiMetadata)
    .where(revisionWhere())
    .get();
  const revision = (counter?.revision ?? 0) + 1;
  if (counter) {
    tx.update(aiMetadata).set({ revision }).where(revisionWhere()).run();
  } else {
    tx.insert(aiMetadata)
      .values({ namespace: REVISION_NAMESPACE, key: REVISION_KEY, value: null, revision })
      .run();
  }
  return revision;
}

/** JSON.stringify(undefined) is undefined, which better-sqlite3 cannot bind. */
function normalizeMetadataValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

function writeMetadata(
  tx: DbTransaction,
  namespace: string,
  key: string,
  value: unknown,
  revision: number,
): void {
  const where = and(eq(aiMetadata.namespace, namespace), eq(aiMetadata.key, key));
  const existing = tx.select({ revision: aiMetadata.revision }).from(aiMetadata).where(where).get();
  if (existing) {
    tx.update(aiMetadata)
      .set({ value: normalizeMetadataValue(value), revision })
      .where(where)
      .run();
  } else {
    tx.insert(aiMetadata)
      .values({ namespace, key, value: normalizeMetadataValue(value), revision })
      .run();
  }
}

export function createSqlitePersistence(db: DB): ChatPersistence {
  const messages = defineMessageStore({
    // The middleware never passes paging hints and the contract explicitly
    // allows an adapter to ignore them, so always return the full transcript.
    loadThread: (threadId: string, _options?: { limit?: number; before?: string }) =>
      fromSync(() => {
        const row = db
          .select({ messages: aiChatThreads.messages })
          .from(aiChatThreads)
          .where(eq(aiChatThreads.threadId, threadId))
          .get();
        return toModelMessages(row?.messages ?? []);
      }),
    saveThread: (threadId, transcript) =>
      fromSync(() => {
        const updatedAt = new Date();
        db.insert(aiChatThreads)
          .values({ threadId, messages: transcript, updatedAt })
          .onConflictDoUpdate({
            target: aiChatThreads.threadId,
            set: { messages: transcript, updatedAt },
          })
          .run();
      }),
  });

  const runs = defineRunStore({
    createOrResume: (input: CreateRunInput) =>
      fromSync(() => {
        const inserted = db
          .insert(aiRuns)
          .values({
            runId: input.runId,
            threadId: input.threadId,
            parentRunId: input.parentRunId ?? null,
            subagentRunId: input.subagentRunId ?? null,
            name: input.name ?? null,
            status: input.status ?? "running",
            startedAt: new Date(input.startedAt),
            cancelRequested: false,
          })
          .onConflictDoNothing()
          .returning()
          .get();
        const row = inserted ?? db.select().from(aiRuns).where(eq(aiRuns.runId, input.runId)).get();
        if (!row) {
          throw new PersistenceRowError({
            message: `Run ${input.runId} disappeared while being created`,
            store: "runs",
            id: input.runId,
          });
        }
        return toRunRecord(row);
      }),
    update: (runId: string, patch: RunPatch) =>
      fromSync(() => {
        const values = runUpdateSet(patch);
        if (Object.keys(values).length === 0) return;
        db.update(aiRuns).set(values).where(eq(aiRuns.runId, runId)).run();
      }),
    get: (runId: string) =>
      fromSync(() => {
        const row = db.select().from(aiRuns).where(eq(aiRuns.runId, runId)).get();
        return row ? toRunRecord(row) : null;
      }),
    findActiveRun: (threadId: string) =>
      fromSync(() => {
        const row = db
          .select()
          .from(aiRuns)
          .where(and(eq(aiRuns.threadId, threadId), eq(aiRuns.status, "running")))
          .orderBy(desc(aiRuns.startedAt), desc(aiRuns.runId))
          .get();
        return row ? toRunRecord(row) : null;
      }),
    listByThread: (threadId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiRuns)
          .where(eq(aiRuns.threadId, threadId))
          .orderBy(asc(aiRuns.startedAt), asc(aiRuns.runId))
          .all()
          .map(toRunRecord),
      ),
    listByParentRun: (parentRunId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiRuns)
          .where(eq(aiRuns.parentRunId, parentRunId))
          .orderBy(asc(aiRuns.startedAt), asc(aiRuns.runId))
          .all()
          .map(toRunRecord),
      ),
    listReclaimable: (opts: { now: number; ttlMs: number }) =>
      fromSync(() => {
        const cutoff = opts.now - opts.ttlMs;
        return db
          .select()
          .from(aiRuns)
          .where(
            and(
              eq(aiRuns.status, "running"),
              isNotNull(aiRuns.detachedSince),
              lte(aiRuns.detachedSince, new Date(cutoff)),
            ),
          )
          .orderBy(asc(aiRuns.detachedSince), asc(aiRuns.runId))
          .all()
          .map(toRunRecord);
      }),
  });

  const interrupts = defineInterruptStore({
    create: (record: Omit<InterruptRecord, "status" | "resolvedAt">) =>
      fromSync(() => {
        db.insert(aiInterrupts)
          .values({
            interruptId: record.interruptId,
            runId: record.runId,
            threadId: record.threadId,
            status: "pending",
            requestedAt: new Date(record.requestedAt),
            payload: record.payload,
          })
          .onConflictDoNothing()
          .run();
      }),
    resolve: (interruptId: string, response?: unknown) =>
      fromSync(() => {
        db.update(aiInterrupts)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
            response: response === undefined ? null : response,
          })
          .where(eq(aiInterrupts.interruptId, interruptId))
          .run();
      }),
    cancel: (interruptId: string) =>
      fromSync(() => {
        db.update(aiInterrupts)
          .set({ status: "cancelled", resolvedAt: new Date() })
          .where(eq(aiInterrupts.interruptId, interruptId))
          .run();
      }),
    commitBatch: (entries: ReadonlyArray<InterruptCommitEntry>) =>
      fromSync(() => {
        db.transaction((tx) => {
          const seen = new Set<string>();
          for (const entry of entries) {
            if (seen.has(entry.interruptId)) {
              throw new Error(`Interrupt batch contains duplicate id: ${entry.interruptId}`);
            }
            seen.add(entry.interruptId);
            const row = tx
              .select({ status: aiInterrupts.status })
              .from(aiInterrupts)
              .where(eq(aiInterrupts.interruptId, entry.interruptId))
              .get();
            if (!row) {
              throw new Error(`Interrupt batch references missing id: ${entry.interruptId}`);
            }
            if (row.status !== "pending") {
              throw new Error(`Interrupt batch references non-pending id: ${entry.interruptId}`);
            }
          }

          const resolvedAt = new Date();
          for (const entry of entries) {
            const where = eq(aiInterrupts.interruptId, entry.interruptId);
            if (entry.status === "resolved") {
              tx.update(aiInterrupts)
                .set({
                  status: "resolved",
                  resolvedAt,
                  response: entry.response === undefined ? null : entry.response,
                })
                .where(where)
                .run();
            } else {
              tx.update(aiInterrupts).set({ status: "cancelled", resolvedAt }).where(where).run();
            }
          }
        });
      }),
    get: (interruptId: string) =>
      fromSync(() => {
        const row = db
          .select()
          .from(aiInterrupts)
          .where(eq(aiInterrupts.interruptId, interruptId))
          .get();
        return row ? toInterruptRecord(row) : null;
      }),
    list: (threadId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiInterrupts)
          .where(eq(aiInterrupts.threadId, threadId))
          .orderBy(asc(aiInterrupts.requestedAt), asc(aiInterrupts.interruptId))
          .all()
          .map(toInterruptRecord),
      ),
    listPending: (threadId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiInterrupts)
          .where(and(eq(aiInterrupts.threadId, threadId), eq(aiInterrupts.status, "pending")))
          .orderBy(asc(aiInterrupts.requestedAt), asc(aiInterrupts.interruptId))
          .all()
          .map(toInterruptRecord),
      ),
    listByRun: (runId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiInterrupts)
          .where(eq(aiInterrupts.runId, runId))
          .orderBy(asc(aiInterrupts.requestedAt), asc(aiInterrupts.interruptId))
          .all()
          .map(toInterruptRecord),
      ),
    listPendingByRun: (runId: string) =>
      fromSync(() =>
        db
          .select()
          .from(aiInterrupts)
          .where(and(eq(aiInterrupts.runId, runId), eq(aiInterrupts.status, "pending")))
          .orderBy(asc(aiInterrupts.requestedAt), asc(aiInterrupts.interruptId))
          .all()
          .map(toInterruptRecord),
      ),
  });

  const metadata = defineMetadataStore({
    get: (namespace: string, key: string) =>
      fromSync(() => {
        const row = db
          .select({ value: aiMetadata.value })
          .from(aiMetadata)
          .where(and(eq(aiMetadata.namespace, namespace), eq(aiMetadata.key, key)))
          .get();
        return row ? row.value : null;
      }),
    set: (namespace: string, key: string, value: unknown) =>
      fromSync(() => {
        db.transaction((tx) => {
          const revision = nextRevision(tx);
          writeMetadata(tx, namespace, key, value, revision);
        });
      }),
    delete: (namespace: string, key: string) =>
      fromSync(() => {
        db.delete(aiMetadata)
          .where(and(eq(aiMetadata.namespace, namespace), eq(aiMetadata.key, key)))
          .run();
      }),
    getVersioned: (namespace: string, key: string) =>
      fromSync(() => {
        const row = db
          .select({ value: aiMetadata.value, revision: aiMetadata.revision })
          .from(aiMetadata)
          .where(and(eq(aiMetadata.namespace, namespace), eq(aiMetadata.key, key)))
          .get();
        return row ? { value: row.value, revision: String(row.revision) } : null;
      }),
    setIf: (namespace: string, key: string, value: unknown, expectedRevision: string | null) =>
      fromSync(() => {
        type SetIfResult = { ok: true; revision: string } | { ok: false; reason: "conflict" };
        return db.transaction((tx): SetIfResult => {
          const where = and(eq(aiMetadata.namespace, namespace), eq(aiMetadata.key, key));
          const existing = tx
            .select({ revision: aiMetadata.revision })
            .from(aiMetadata)
            .where(where)
            .get();
          const current = existing ? String(existing.revision) : null;
          if (current !== expectedRevision) {
            return { ok: false, reason: "conflict" };
          }
          const revision = nextRevision(tx);
          writeMetadata(tx, namespace, key, value, revision);
          return { ok: true, revision: String(revision) };
        });
      }),
  });

  return {
    stores: { messages, runs, interrupts, metadata },
  };
}
