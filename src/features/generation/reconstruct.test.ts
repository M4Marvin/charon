import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconstructChat } from "@tanstack/ai-persistence";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { createSqlitePersistence } from "./persistence";

describe("TanStack persistence hydrate", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;
  let userId: string;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("returns a persisted transcript for the thread", async () => {
    const persistence = createSqlitePersistence(db);
    await persistence.stores.messages.saveThread(userId, [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);

    const response = await reconstructChat(
      persistence,
      new Request(`http://localhost/api/generation/chat?threadId=${userId}`),
      { authorize: async () => true },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      messages: Array<{ role: string; parts: Array<{ type: string; content?: string }> }>;
      activeRun: unknown;
      interrupts: unknown;
    };
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]?.role).toBe("user");
    expect(body.messages[1]?.role).toBe("assistant");
    expect(body.activeRun).toBeNull();
    expect(body.interrupts).toBeNull();
  });

  it("does not hydrate unknown threads", async () => {
    const persistence = createSqlitePersistence(db);
    const response = await reconstructChat(
      persistence,
      new Request("http://localhost/api/generation/chat?threadId=missing"),
      { authorize: async () => true },
    );
    const body = (await response.json()) as { messages: unknown[] };
    expect(body.messages).toEqual([]);
  });
});
