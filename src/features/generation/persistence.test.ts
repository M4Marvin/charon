import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ModelMessage } from "@tanstack/ai";
import { makeTestDb, seedTestUser, type TestDb, type TestSqlite } from "@/db/__tests__/helpers";
import { createSqlitePersistence } from "./persistence";

describe("createSqlitePersistence", () => {
  let db: TestDb;
  let sqlite: TestSqlite;

  beforeEach(() => {
    const context = makeTestDb();
    db = context.db;
    sqlite = context.sqlite;
    seedTestUser(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("exposes the four chat persistence stores", () => {
    const persistence = createSqlitePersistence(db);
    expect(Object.keys(persistence.stores).sort()).toEqual([
      "interrupts",
      "messages",
      "metadata",
      "runs",
    ]);
  });

  describe("messages", () => {
    it("round-trips a transcript, returns [] for an unknown thread, and overwrites", async () => {
      const { messages } = createSqlitePersistence(db).stores;
      expect(await messages.loadThread("missing-thread")).toEqual([]);

      const transcript: Array<ModelMessage> = [
        { role: "user", content: "hello" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "search", arguments: '{"q":"x"}' },
            },
          ],
        },
        { role: "tool", content: '{"ok":true}', toolCallId: "call-1" },
      ];

      await messages.saveThread("thread-1", transcript);
      expect(await messages.loadThread("thread-1")).toEqual(transcript);

      // saveThread is an overwrite, never an append.
      const replacement: Array<ModelMessage> = [{ role: "user", content: "redo" }];
      await messages.saveThread("thread-1", replacement);
      expect(await messages.loadThread("thread-1")).toEqual(replacement);

      // Paging hints are optional and this adapter returns the full transcript.
      expect(await messages.loadThread("thread-1", { limit: 1 })).toEqual(replacement);
    });
  });

  describe("runs", () => {
    it("creates or resumes idempotently and returns null for unknown ids", async () => {
      const { runs } = createSqlitePersistence(db).stores;
      expect(await runs.get("missing-run")).toBeNull();

      const created = await runs.createOrResume({
        runId: "run-1",
        threadId: "thread-1",
        startedAt: 1_000,
      });
      expect(created).toMatchObject({
        runId: "run-1",
        threadId: "thread-1",
        status: "running",
        startedAt: 1_000,
      });
      expect(created.finishedAt).toBeUndefined();
      expect(created.parentRunId).toBeUndefined();

      const resumed = await runs.createOrResume({
        runId: "run-1",
        threadId: "other-thread",
        startedAt: 9_999,
        status: "completed",
      });
      expect(resumed).toEqual(created);

      await runs.update("missing-run", { status: "completed" });
      expect(await runs.get("missing-run")).toBeNull();
    });

    it("updates mutable fields and finds the most recent active run", async () => {
      const { runs } = createSqlitePersistence(db).stores;
      expect(await runs.findActiveRun("thread-1")).toBeNull();

      await runs.createOrResume({ runId: "old", threadId: "thread-1", startedAt: 1_000 });
      await runs.createOrResume({ runId: "new", threadId: "thread-1", startedAt: 2_000 });
      await runs.createOrResume({ runId: "other", threadId: "thread-2", startedAt: 3_000 });

      expect((await runs.findActiveRun("thread-1"))?.runId).toBe("new");

      await runs.update("new", {
        status: "completed",
        finishedAt: 2_500,
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      });
      const completed = await runs.get("new");
      expect(completed).toMatchObject({
        status: "completed",
        finishedAt: 2_500,
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      });
      expect((await runs.findActiveRun("thread-1"))?.runId).toBe("old");

      await runs.update("old", {
        status: "failed",
        error: { message: "boom", code: "provider_error" },
        detachedSince: 1_234,
        cancelRequested: true,
        driverEpoch: 7,
      });
      expect(await runs.get("old")).toMatchObject({
        status: "failed",
        error: { message: "boom", code: "provider_error" },
        detachedSince: 1_234,
        cancelRequested: true,
        driverEpoch: 7,
      });
      expect(await runs.findActiveRun("thread-1")).toBeNull();

      // Explicit undefined clears an optional column (reattach).
      await runs.update("new", { detachedSince: 5 });
      await runs.update("new", { detachedSince: undefined });
      expect((await runs.get("new"))?.detachedSince).toBeUndefined();
    });

    it("lists runs by thread and by parent run in startedAt order", async () => {
      const { runs } = createSqlitePersistence(db).stores;
      const { listByThread, listByParentRun } = runs;
      if (!listByThread || !listByParentRun) {
        throw new Error("sqlite run store must implement the optional list methods");
      }
      await runs.createOrResume({ runId: "parent", threadId: "thread-1", startedAt: 1 });
      await runs.createOrResume({
        runId: "child-b",
        threadId: "subagent:child-b",
        startedAt: 20,
        parentRunId: "parent",
        subagentRunId: "sub-b",
        name: "writer",
      });
      await runs.createOrResume({
        runId: "child-a",
        threadId: "subagent:child-a",
        startedAt: 10,
        parentRunId: "parent",
        subagentRunId: "sub-a",
        name: "researcher",
      });

      expect((await listByThread("thread-1")).map((run) => run.runId)).toEqual(["parent"]);
      expect((await listByParentRun("parent")).map((run) => run.runId)).toEqual([
        "child-a",
        "child-b",
      ]);
      expect(await listByParentRun("missing-parent")).toEqual([]);
    });
  });

  describe("interrupts", () => {
    it("creates pending interrupts, resolves or cancels them, and lists in requestedAt order", async () => {
      const { interrupts } = createSqlitePersistence(db).stores;
      expect(await interrupts.get("missing-interrupt")).toBeNull();

      await interrupts.create({
        interruptId: "int-1",
        runId: "run-1",
        threadId: "thread-1",
        requestedAt: 100,
        payload: { tool: "search", args: { q: "x" } },
      });
      await interrupts.create({
        interruptId: "int-2",
        runId: "run-1",
        threadId: "thread-1",
        requestedAt: 200,
        payload: { tool: "write" },
      });
      await interrupts.create({
        interruptId: "int-3",
        runId: "run-2",
        threadId: "thread-1",
        requestedAt: 300,
        payload: {},
      });

      expect((await interrupts.list("thread-1")).map((entry) => entry.interruptId)).toEqual([
        "int-1",
        "int-2",
        "int-3",
      ]);
      expect((await interrupts.listPending("thread-1")).map((entry) => entry.interruptId)).toEqual([
        "int-1",
        "int-2",
        "int-3",
      ]);
      expect((await interrupts.listByRun("run-1")).map((entry) => entry.interruptId)).toEqual([
        "int-1",
        "int-2",
      ]);
      expect(
        (await interrupts.listPendingByRun("run-1")).map((entry) => entry.interruptId),
      ).toEqual(["int-1", "int-2"]);

      const before = Date.now();
      await interrupts.resolve("int-1", { ok: true });
      const resolved = await interrupts.get("int-1");
      expect(resolved).toMatchObject({ status: "resolved", response: { ok: true } });
      expect(resolved?.resolvedAt).toBeGreaterThanOrEqual(before);

      await interrupts.cancel("int-2");
      expect((await interrupts.get("int-2"))?.status).toBe("cancelled");

      expect((await interrupts.listPending("thread-1")).map((entry) => entry.interruptId)).toEqual([
        "int-3",
      ]);
      expect(await interrupts.listPendingByRun("run-1")).toEqual([]);

      // Resolving/cancelling an unknown id is a no-op.
      await interrupts.resolve("missing-interrupt", {});
      await interrupts.cancel("missing-interrupt");
      expect(await interrupts.get("missing-interrupt")).toBeNull();
    });

    it("create is insert-if-absent and never clobbers a resolved interrupt", async () => {
      const { interrupts } = createSqlitePersistence(db).stores;
      await interrupts.create({
        interruptId: "int-dup",
        runId: "run-1",
        threadId: "thread-1",
        requestedAt: 100,
        payload: { attempt: 1 },
      });
      await interrupts.resolve("int-dup", { answer: 42 });

      await interrupts.create({
        interruptId: "int-dup",
        runId: "run-1",
        threadId: "thread-1",
        requestedAt: 200,
        payload: { attempt: 2 },
      });

      expect(await interrupts.get("int-dup")).toMatchObject({
        status: "resolved",
        requestedAt: 100,
        payload: { attempt: 1 },
        response: { answer: 42 },
      });
    });

    it("commits a validated batch atomically", async () => {
      const { interrupts } = createSqlitePersistence(db).stores;
      const { commitBatch } = interrupts;
      if (!commitBatch) {
        throw new Error("sqlite interrupt store must implement commitBatch");
      }
      for (const id of ["batch-1", "batch-2", "batch-3"]) {
        await interrupts.create({
          interruptId: id,
          runId: "run-batch",
          threadId: "thread-batch",
          requestedAt: 1,
          payload: {},
        });
      }

      await commitBatch([
        { interruptId: "batch-1", status: "resolved", response: { ok: true } },
        { interruptId: "batch-2", status: "cancelled" },
      ]);
      expect(await interrupts.get("batch-1")).toMatchObject({
        status: "resolved",
        response: { ok: true },
      });
      expect((await interrupts.get("batch-2"))?.status).toBe("cancelled");

      await expect(commitBatch([{ interruptId: "missing", status: "cancelled" }])).rejects.toThrow(
        /missing/,
      );
      await expect(commitBatch([{ interruptId: "batch-1", status: "cancelled" }])).rejects.toThrow(
        /non-pending/,
      );
      await expect(
        commitBatch([
          { interruptId: "batch-3", status: "cancelled" },
          { interruptId: "batch-3", status: "cancelled" },
        ]),
      ).rejects.toThrow(/duplicate/);

      // A rejected batch writes nothing.
      expect((await interrupts.get("batch-3"))?.status).toBe("pending");
    });
  });

  describe("metadata", () => {
    it("round-trips namespaced values and deletes without collisions", async () => {
      const { metadata } = createSqlitePersistence(db).stores;
      expect(await metadata.get("ns-a", "k")).toBeNull();

      await metadata.set("ns-a", "k", { n: 1 });
      await metadata.set("ns-b", "k", { n: 2 });
      expect(await metadata.get("ns-a", "k")).toEqual({ n: 1 });
      expect(await metadata.get("ns-b", "k")).toEqual({ n: 2 });

      await metadata.set("a:b", "c", "left");
      await metadata.set("a", "b:c", "right");
      expect(await metadata.get("a:b", "c")).toBe("left");
      expect(await metadata.get("a", "b:c")).toBe("right");

      await metadata.delete("ns-a", "k");
      await metadata.delete("ns-a", "k");
      expect(await metadata.get("ns-a", "k")).toBeNull();
      expect(await metadata.get("ns-b", "k")).toEqual({ n: 2 });
    });

    it("versions every write and supports compare-and-set", async () => {
      const { metadata } = createSqlitePersistence(db).stores;
      const { getVersioned, setIf } = metadata;
      if (!getVersioned || !setIf) {
        throw new Error("sqlite metadata store must implement versioned writes");
      }
      expect(await getVersioned("cas", "k")).toBeNull();

      await metadata.set("cas", "k", { n: 1 });
      const first = await getVersioned("cas", "k");
      expect(first).toEqual({ value: { n: 1 }, revision: "1" });

      await metadata.set("cas", "k", { n: 2 });
      const second = await getVersioned("cas", "k");
      expect(second?.value).toEqual({ n: 2 });
      expect(second?.revision).not.toBe(first?.revision);

      expect(await setIf("cas", "k", { n: 3 }, first?.revision ?? null)).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(await metadata.get("cas", "k")).toEqual({ n: 2 });

      const updated = await setIf("cas", "k", { n: 3 }, second?.revision ?? null);
      expect(updated.ok).toBe(true);
      if (updated.ok) expect(updated.revision).not.toBe(second?.revision);
      expect(await metadata.get("cas", "k")).toEqual({ n: 3 });

      // Create-if-absent: only a null expected revision can insert.
      expect(await setIf("cas", "fresh", "x", "bogus")).toEqual({
        ok: false,
        reason: "conflict",
      });
      const created = await setIf("cas", "fresh", "x", null);
      expect(created.ok).toBe(true);
      expect(await metadata.get("cas", "fresh")).toBe("x");

      // A deleted revision is never reissued.
      await metadata.delete("cas", "k");
      expect(await getVersioned("cas", "k")).toBeNull();
      const recreated = await setIf("cas", "k", { n: 4 }, null);
      expect(recreated.ok).toBe(true);
      if (recreated.ok) expect(recreated.revision).not.toBe(second?.revision);
    });
  });
});
