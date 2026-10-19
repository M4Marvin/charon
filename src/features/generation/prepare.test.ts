import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters, chatMessages, aiProviders, userSettings, generationJobs } from "@/db/schema";
import { createChat, appendUserAndReply, getMessages } from "@/features/chat/tree/service";
import { prepareGeneration } from "./prepare";
import { createProposal, getJob, getProposal } from "@/db/repositories/generation";
import { acceptProposal, denyProposal } from "./proposals";
import { ChatBusyError, StaleTargetError } from "./errors";

describe("generation prepare and proposals", () => {
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

  it("prepares a send with a durable job and streaming placeholder", async () => {
    const prepared = await prepareGeneration(userId, { chatId, trigger: "send", content: "Hi" }, "User", db);
    const job = getJob(prepared.jobId, db);
    expect(job?.status).toBe("queued");
    expect(job?.placeholderLocalId).toBe(prepared.placeholderLocalId);
    const reply = db.select().from(chatMessages).where(eq(chatMessages.localId, prepared.placeholderLocalId)).get();
    expect(reply?.content).toBe("");
    expect(reply?.extra).toMatchObject({ isStreaming: true, generationJobId: prepared.jobId });
  });

  it("rejects a second job while one is active", async () => {
    await prepareGeneration(userId, { chatId, trigger: "send", content: "Hi" }, "User", db);
    await expect(
      prepareGeneration(userId, { chatId, trigger: "send", content: "Again" }, "User", db),
    ).rejects.toBeInstanceOf(ChatBusyError);
  });

  it("reclaims an expired lease instead of wedging the chat", async () => {
    const first = await prepareGeneration(userId, { chatId, trigger: "send", content: "Hi" }, "User", db);
    db.update(generationJobs)
      .set({ status: "running", leaseOwner: "dead", leaseExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(generationJobs.id, first.jobId))
      .run();

    const second = await prepareGeneration(userId, { chatId, trigger: "send", content: "Again" }, "User", db);
    expect(second.jobId).not.toBe(first.jobId);
    expect(getJob(first.jobId, db)?.status).toBe("expired");
  });

  it("accepts a rewrite with a revision and rejects a stale base revision", async () => {
    const { replyMessage } = appendUserAndReply(chatId, "Hello", "First reply", undefined, db);
    const prepared = await prepareGeneration(
      userId,
      { chatId, trigger: "rewrite", messageLocalId: replyMessage.localId },
      "User",
      db,
    );
    const proposal = createProposal(
      {
        jobId: prepared.jobId,
        chatId,
        kind: "rewrite",
        targetLocalId: replyMessage.localId,
        baseRev: 0,
        baseHash: null,
        proposedContent: "Rewritten reply",
        proposedRole: "assistant",
      },
      db,
    );

    const accepted = acceptProposal(proposal.id, db);
    expect(accepted.messageLocalId).toBe(replyMessage.localId);
    expect(getProposal(proposal.id, db)?.status).toBe("accepted");
    const updated = db.select().from(chatMessages).where(eq(chatMessages.localId, replyMessage.localId)).get();
    expect(updated?.content).toBe("Rewritten reply");
    expect(updated?.extra).toMatchObject({ rev: 1 });

    const second = createProposal(
      {
        jobId: prepared.jobId,
        chatId,
        kind: "rewrite",
        targetLocalId: replyMessage.localId,
        baseRev: 0,
        baseHash: null,
        proposedContent: "Stale reply",
        proposedRole: "assistant",
      },
      db,
    );
    expect(() => acceptProposal(second.id, db)).toThrow(StaleTargetError);
  });

  it("accepts a transform by appending, never mutating the source", async () => {
    const { userMessage, replyMessage } = appendUserAndReply(chatId, "Hello", "First reply", undefined, db);
    const prepared = await prepareGeneration(
      userId,
      { chatId, trigger: "transform", selection: [userMessage.localId, replyMessage.localId] },
      "User",
      db,
    );
    const proposal = createProposal(
      {
        jobId: prepared.jobId,
        chatId,
        kind: "transform",
        proposedContent: "Transformed scene",
        proposedRole: "assistant",
      },
      db,
    );
    const accepted = acceptProposal(proposal.id, db);
    expect(accepted.messageLocalId).not.toBeNull();
    expect(getMessages(chatId, db).find((m) => m.localId === replyMessage.localId)?.content).toBe("First reply");
    expect(getMessages(chatId, db).find((m) => m.localId === accepted.messageLocalId)?.content).toBe(
      "Transformed scene",
    );
  });

  it("denies a proposal without writing", async () => {
    const { replyMessage } = appendUserAndReply(chatId, "Hello", "First reply", undefined, db);
    const prepared = await prepareGeneration(
      userId,
      { chatId, trigger: "rewrite", messageLocalId: replyMessage.localId },
      "User",
      db,
    );
    const proposal = createProposal(
      {
        jobId: prepared.jobId,
        chatId,
        kind: "rewrite",
        targetLocalId: replyMessage.localId,
        proposedContent: "Nope",
      },
      db,
    );
    denyProposal(proposal.id, db);
    expect(getProposal(proposal.id, db)?.status).toBe("rejected");
    expect(getMessages(chatId, db).find((m) => m.localId === replyMessage.localId)?.content).toBe("First reply");
  });
});
