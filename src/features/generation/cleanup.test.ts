import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { aiProviders, characters, chatMessages, userSettings } from "@/db/schema";
import { createChat, getMessages } from "@/features/chat/tree/service";
import { beginJob, failJob, getJob } from "@/db/repositories/generation";
import { prepareGeneration } from "./prepare";
import { finalizeChat } from "./finalize";
import {
  cancelGeneration,
  discardUnfinishedPlaceholder,
  failJobAndDiscardPlaceholder,
} from "./cleanup";

describe("generation placeholder cleanup", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;
  let userId: string;
  let chatId: string;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    const data = makeCharacterData();
    db.insert(characters)
      .values({
        id: "char-1",
        name: data.name,
        data,
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(aiProviders)
      .values({
        id: "prov-1",
        name: "Test",
        baseUrl: "http://localhost:11434",
        apiKey: "test-key",
        defaultModel: "test-model",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(userSettings)
      .values({ userId, defaultProviderId: "prov-1", defaultSelectedModel: "test-model" })
      .run();
    chatId = createChat({ characterId: "char-1", title: "Test", greetings: ["Hello!"] }, db).id;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function message(localId: number) {
    return db.select().from(chatMessages).where(eq(chatMessages.localId, localId)).get();
  }

  async function prepareSend(content = "Hi") {
    return prepareGeneration(userId, { chatId, trigger: "send", content }, "User", db);
  }

  it("fails a prepared job and removes its placeholder", async () => {
    const prepared = await prepareSend();
    const failed = failJobAndDiscardPlaceholder(
      {
        jobId: prepared.jobId,
        code: "config",
        message: "No provider",
      },
      db,
    );

    expect(failed).toBe(true);
    expect(getJob(prepared.jobId, db)?.status).toBe("failed");
    expect(message(prepared.placeholderLocalId)).toBeUndefined();
    // The user turn stays so the send can be retried.
    expect(getMessages(chatId, db).some((m) => m.content === "Hi")).toBe(true);
  });

  it("does not let an ownerless failure kill another request's running job", async () => {
    const prepared = await prepareSend();
    beginJob({ jobId: prepared.jobId, owner: "owner-a" }, db);

    const failed = failJobAndDiscardPlaceholder(
      {
        jobId: prepared.jobId,
        code: "internal",
        message: "duplicate setup",
      },
      db,
    );

    expect(failed).toBe(false);
    expect(getJob(prepared.jobId, db)?.status).toBe("running");
    expect(message(prepared.placeholderLocalId)).toBeDefined();
  });

  it("cancels a prepared job and removes its placeholder", async () => {
    const prepared = await prepareSend();

    expect(cancelGeneration(prepared.jobId, db)).toBe(true);
    expect(getJob(prepared.jobId, db)?.status).toBe("cancelled");
    expect(message(prepared.placeholderLocalId)).toBeUndefined();
  });

  it("cleans up a failed job the client only learns about later", async () => {
    const prepared = await prepareSend();
    // A server-side failure path that did not use the cleanup helper.
    failJob({ jobId: prepared.jobId, code: "provider_error", message: "boom" }, db);
    expect(message(prepared.placeholderLocalId)).toBeDefined();

    expect(cancelGeneration(prepared.jobId, db)).toBe(false);
    expect(getJob(prepared.jobId, db)?.status).toBe("failed");
    expect(message(prepared.placeholderLocalId)).toBeUndefined();
  });

  it("never deletes a finished reply", async () => {
    const prepared = await prepareSend();
    const lease = beginJob({ jobId: prepared.jobId, owner: "owner-a" }, db);
    finalizeChat(
      {
        jobId: prepared.jobId,
        owner: "owner-a",
        epoch: lease.leaseEpoch,
        text: "The reply",
      },
      db,
    );

    expect(cancelGeneration(prepared.jobId, db)).toBe(false);
    expect(discardUnfinishedPlaceholder(prepared.jobId, db)).toBe(false);
    expect(message(prepared.placeholderLocalId)?.content).toBe("The reply");
    expect(getJob(prepared.jobId, db)?.status).toBe("succeeded");
  });

  it("will not delete a message whose localId was reused by another job", async () => {
    const prepared = await prepareSend();
    failJob({ jobId: prepared.jobId, code: "provider_error", message: "boom" }, db);
    db.update(chatMessages)
      .set({ extra: { isStreaming: true, generationJobId: "another-job" } })
      .where(eq(chatMessages.localId, prepared.placeholderLocalId))
      .run();

    expect(discardUnfinishedPlaceholder(prepared.jobId, db)).toBe(false);
    expect(message(prepared.placeholderLocalId)).toBeDefined();
  });
});
