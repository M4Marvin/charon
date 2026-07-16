import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters, chatMessages } from "@/db/schema";
import {
  appendMessage,
  appendUserAndReply,
  createChat,
  deleteBranch,
  editMessage,
  getChat,
  swipe,
} from "./service";
import { acquireGenerationLock, ensureChatIdle, releaseLock, STALE_LOCK_MS } from "./lock";

describe("lock", () => {
  let db: TestDb;
  let userId: string;
  let charId: string;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    const data = makeCharacterData();
    charId = "char-1";
    db.insert(characters)
      .values({
        id: charId,
        userId,
        name: data.name,
        data,
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  });

  function createTestChat() {
    return createChat(userId, { characterId: charId, title: "Test", greetings: ["Hi"] }, db);
  }

  function forceStaleLock(chatId: string, messageId: number) {
    db.update(chatMessages)
      .set({
        extra: {
          lock: "generating",
          messageId,
          lockedAt: Date.now() - STALE_LOCK_MS - 1,
        },
      })
      .where(and(eq(chatMessages.chatId, chatId), eq(chatMessages.localId, 0)))
      .run();
  }

  function readRootExtra(chatId: string) {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.chatId, chatId), eq(chatMessages.localId, 0)))
      .get()?.extra;
  }

  describe("ChatDetail lock state", () => {
    it("returns lockState 'idle' and lockMessageLocalId null on fresh chat", () => {
      const chat = createTestChat();
      const detail = getChat(userId, chat.id, db);
      expect(detail.lockState).toBe("idle");
      expect(detail.lockMessageLocalId).toBeNull();
    });

    it("returns lockState 'generating' and lockMessageLocalId when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      const detail = getChat(userId, chat.id, db);
      expect(detail.lockState).toBe("generating");
      expect(detail.lockMessageLocalId).toBe(1);
    });
  });

  describe("ensureChatIdle", () => {
    it("is no-op when idle", () => {
      const chat = createTestChat();
      expect(() => ensureChatIdle(userId, chat.id, db)).not.toThrow();
    });

    it("throws when lock is active", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => ensureChatIdle(userId, chat.id, db)).toThrow("Chat is busy");
    });

    it("clears stale lock and does not throw", () => {
      const chat = createTestChat();
      forceStaleLock(chat.id, 1);
      expect(readRootExtra(chat.id)).not.toBeNull();
      expect(() => ensureChatIdle(userId, chat.id, db)).not.toThrow();
      expect(readRootExtra(chat.id)).toBeNull();
    });
  });

  describe("acquireGenerationLock", () => {
    it("sets root.extra to lock state with correct messageId", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      const extra = readRootExtra(chat.id);
      expect(extra).toEqual({
        lock: "generating",
        messageId: 1,
        lockedAt: expect.any(Number) as number,
      });
    });

    it("throws when already locked (active)", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => acquireGenerationLock(userId, chat.id, 2, db)).toThrow("Chat is busy");
    });

    it("clears stale lock and acquires successfully", () => {
      const chat = createTestChat();
      forceStaleLock(chat.id, 1);
      acquireGenerationLock(userId, chat.id, 2, db);
      const extra = readRootExtra(chat.id);
      expect(extra).toEqual({
        lock: "generating",
        messageId: 2,
        lockedAt: expect.any(Number) as number,
      });
    });
  });

  describe("releaseLock", () => {
    it("clears root.extra to null", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      releaseLock(userId, chat.id, db);
      expect(readRootExtra(chat.id)).toBeNull();
    });

    it("is no-op when not locked", () => {
      const chat = createTestChat();
      expect(() => releaseLock(userId, chat.id, db)).not.toThrow();
      expect(readRootExtra(chat.id)).toBeNull();
    });
  });

  describe("mutation rejection when locked", () => {
    it("appendMessage throws when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => appendMessage(userId, chat.id, { role: "user", content: "hi" }, db)).toThrow(
        "Chat is busy",
      );
    });

    it("appendUserAndReply throws when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => appendUserAndReply(userId, chat.id, "hi", "reply", undefined, db)).toThrow(
        "Chat is busy",
      );
    });

    it("swipe throws when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => swipe(userId, chat.id, 1, "next", undefined, db)).toThrow("Chat is busy");
    });

    it("editMessage throws when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => editMessage(userId, chat.id, 1, "edited", db)).toThrow("Chat is busy");
    });

    it("deleteBranch throws when locked", () => {
      const chat = createTestChat();
      acquireGenerationLock(userId, chat.id, 1, db);
      expect(() => deleteBranch(userId, chat.id, 1, db)).toThrow("Chat is busy");
    });
  });

  describe("mutation succeeds after stale lock cleared", () => {
    it("appendMessage succeeds (stale lock auto-cleared)", () => {
      const chat = createTestChat();
      forceStaleLock(chat.id, 1);
      const msg = appendMessage(userId, chat.id, { role: "user", content: "after stale" }, db);
      expect(msg.content).toBe("after stale");
      expect(readRootExtra(chat.id)).toBeNull();
    });
  });
});
