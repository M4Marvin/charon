import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, seedSecondUser, type TestDb } from "./helpers";
import { makeCharacterData } from "./character-data";
import { characters, chatMessages } from "@/db/schema";
import {
  createChat as repoCreateChat,
  deleteChat as repoDeleteChat,
  getChat as repoGetChat,
  listChats as repoListChats,
  listMessages as repoListMessages,
  insertMessage as repoInsertMessage,
  getMessage as repoGetMessage,
  updateMessage as repoUpdateMessage,
  deleteMessages as repoDeleteMessages,
} from "@/db/repositories/chats";

describe("chats repo", () => {
  let db: TestDb;
  let userId: string;
  let charId: string;

  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
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

  afterEach(() => {
    ctx.sqlite.close();
  });

  describe("chat CRUD", () => {
    it("creates a chat", () => {
      const chat = repoCreateChat(
        { id: "chat-1", userId, characterId: charId, title: "My Chat" },
        db,
      );
      expect(chat.id).toBe("chat-1");
      expect(chat.title).toBe("My Chat");
      expect(chat.characterId).toBe(charId);
    });

    it("lists chats with character info", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "A" }, db);
      repoCreateChat({ id: "chat-2", userId, characterId: charId, title: "B" }, db);
      const all = repoListChats(userId, db);
      expect(all).toHaveLength(2);
      expect(all[0]!.characterName).toBe("Test Character");
    });

    it("gets a chat by id", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "My Chat" }, db);
      const chat = repoGetChat(userId, "chat-1", db);
      expect(chat.id).toBe("chat-1");
    });

    it("throws on get by wrong user", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "My Chat" }, db);
      expect(() => repoGetChat("other-user", "chat-1", db)).toThrow("Chat not found");
    });

    it("lists only the current user's chats", () => {
      const otherId = seedSecondUser(db);
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "Mine" }, db);
      repoCreateChat({ id: "chat-2", userId: otherId, characterId: charId, title: "Theirs" }, db);
      expect(repoListChats(userId, db)).toHaveLength(1);
    });

    it("deletes a chat and its messages", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "My Chat" }, db);
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Hello!",
          extra: null,
        },
        db,
      );
      repoDeleteChat(userId, "chat-1", db);
      expect(() => repoGetChat(userId, "chat-1", db)).toThrow("Chat not found");
      // Verify messages were cascade-deleted (raw query since listMessages checks ownership)
      const remaining = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, "chat-1"))
        .all();
      expect(remaining).toHaveLength(0);
    });

    it("throws on delete by wrong user", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "My Chat" }, db);
      expect(() => repoDeleteChat("other-user", "chat-1", db)).toThrow("Chat not found");
    });
  });

  describe("message CRUD", () => {
    beforeEach(() => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "My Chat" }, db);
    });

    it("inserts and lists messages", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Hello!",
          extra: null,
        },
        db,
      );
      const msgs = repoListMessages(userId, "chat-1", db);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.content).toBe("Hello!");
    });

    it("gets a message by localId", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [2],
          selectedChildLocalId: 2,
          role: "assistant",
          content: "Greeting",
          extra: null,
        },
        db,
      );
      const msg = repoGetMessage(userId, "chat-1", 1, db);
      expect(msg).toBeDefined();
      expect(msg!.children).toEqual([2]);
    });

    it("updates a message", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Hello!",
          extra: null,
        },
        db,
      );
      repoUpdateMessage(userId, "chat-1", 1, { children: [2], selectedChildLocalId: 2 }, db);
      const msg = repoGetMessage(userId, "chat-1", 1, db);
      expect(msg!.children).toEqual([2]);
      expect(msg!.selectedChildLocalId).toBe(2);
    });

    it("deletes messages", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Hello!",
          extra: null,
        },
        db,
      );
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 2,
          parentLocalId: 1,
          children: [],
          selectedChildLocalId: null,
          role: "user",
          content: "Hi!",
          extra: null,
        },
        db,
      );
      repoDeleteMessages(userId, "chat-1", [1, 2], db);
      expect(repoListMessages(userId, "chat-1", db)).toHaveLength(0);
    });

    it("requires chat ownership for message operations", () => {
      expect(() =>
        repoInsertMessage(
          "other-user",
          "chat-1",
          {
            chatId: "chat-1",
            localId: 1,
            parentLocalId: null,
            children: [],
            selectedChildLocalId: null,
            role: "assistant",
            content: "Hello!",
            extra: null,
          },
          db,
        ),
      ).toThrow("Chat not found");
    });

    it("updates content only without touching children/selected", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [2, 3],
          selectedChildLocalId: 2,
          role: "assistant",
          content: "Original",
          extra: null,
        },
        db,
      );
      repoUpdateMessage(userId, "chat-1", 1, { content: "Edited" }, db);
      const msg = repoGetMessage(userId, "chat-1", 1, db);
      expect(msg!.content).toBe("Edited");
      expect(msg!.children).toEqual([2, 3]);
      expect(msg!.selectedChildLocalId).toBe(2);
    });

    it("round-trips a system role message", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 0,
          parentLocalId: null,
          children: [1],
          selectedChildLocalId: 1,
          role: "system",
          content: "",
          extra: null,
        },
        db,
      );
      const root = repoGetMessage(userId, "chat-1", 0, db);
      expect(root).toBeDefined();
      expect(root!.role).toBe("system");
      expect(root!.content).toBe("");
    });

    it("round-trips extra JSON (draft flag)", () => {
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "user",
          content: "",
          extra: { isDraft: true },
        },
        db,
      );
      const msg = repoGetMessage(userId, "chat-1", 1, db);
      expect(msg!.extra).toEqual({ isDraft: true });
    });

    it("supports multiple children of a hidden root (greeting pattern)", () => {
      // Hidden root with three greeting children — the createChat flow shape.
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 0,
          parentLocalId: null,
          children: [1, 2, 3],
          selectedChildLocalId: 1,
          role: "system",
          content: "",
          extra: null,
        },
        db,
      );
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: 0,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Greeting 1",
          extra: null,
        },
        db,
      );
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 2,
          parentLocalId: 0,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Greeting 2",
          extra: null,
        },
        db,
      );
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 3,
          parentLocalId: 0,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Greeting 3",
          extra: null,
        },
        db,
      );
      const all = repoListMessages(userId, "chat-1", db);
      expect(all).toHaveLength(4);
      const root = all.find((m) => m.localId === 0)!;
      expect(root.children).toEqual([1, 2, 3]);
      expect(root.selectedChildLocalId).toBe(1);
    });
  });

  describe("list ordering and preview", () => {
    it("returns null preview when no messages exist", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "Empty chat" }, db);
      const chats = repoListChats(userId, db);
      expect(chats).toHaveLength(1);
      expect(chats[0]!.lastMessagePreview).toBeNull();
    });

    it("returns latest message content as preview", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "Chat" }, db);
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "First",
          extra: null,
        },
        db,
      );
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 2,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Last message",
          extra: null,
        },
        db,
      );
      const chats = repoListChats(userId, db);
      expect(chats[0]!.lastMessagePreview).toBe("Last message");
    });

    it("orders by most recent activity (latest message first)", () => {
      repoCreateChat({ id: "chat-old", userId, characterId: charId, title: "Older" }, db);
      repoInsertMessage(
        userId,
        "chat-old",
        {
          chatId: "chat-old",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Old msg",
          extra: null,
        },
        db,
      );
      const start = Date.now();
      while (Date.now() === start.valueOf()) {
        /* busy-wait ~1ms */
      }
      repoCreateChat({ id: "chat-new", userId, characterId: charId, title: "Newer" }, db);
      repoInsertMessage(
        userId,
        "chat-new",
        {
          chatId: "chat-new",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "New msg",
          extra: null,
        },
        db,
      );
      const chats = repoListChats(userId, db);
      expect(chats).toHaveLength(2);
      expect(chats[0]!.id).toBe("chat-new");
      expect(chats[1]!.id).toBe("chat-old");
    });

    it("bumps updatedAt when a message is inserted", () => {
      repoCreateChat({ id: "chat-1", userId, characterId: charId, title: "Chat" }, db);
      const before = repoGetChat(userId, "chat-1", db).updatedAt;
      // small delay guarantees timestamp change
      const start = Date.now();
      while (Date.now() === start.valueOf()) {
        /* busy-wait ~1ms */
      }
      repoInsertMessage(
        userId,
        "chat-1",
        {
          chatId: "chat-1",
          localId: 1,
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content: "Hello!",
          extra: null,
        },
        db,
      );
      const after = repoGetChat(userId, "chat-1", db).updatedAt;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });
  });
});
