import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters, chatMessages } from "@/db/schema";
import {
  createChat,
  getChat,
  getMessages,
  getActivePath,
  appendMessage,
  appendUserAndReply,
  swipe,
  deleteBranch,
  editMessage,
  deleteChat,
} from "./service";

describe("tree service", () => {
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

  describe("createChat", () => {
    it("creates a chat with root + greetings", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test Chat",
        greetings: ["Hello!", "Hey there!"],
      }, db);

      expect(chat.title).toBe("Test Chat");
      expect(chat.characterId).toBe(charId);

      const msgs = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, chat.id))
        .all();

      // Root + 2 greetings
      expect(msgs).toHaveLength(3);

      const root = msgs.find((m) => m.localId === 0)!;
      expect(root.role).toBe("system");
      expect(root.content).toBe("");
      expect(root.parentLocalId).toBeNull();
      expect(root.children).toEqual([1, 2]);
      expect(root.selectedChildLocalId).toBe(1);

      const g1 = msgs.find((m) => m.localId === 1)!;
      expect(g1.role).toBe("assistant");
      expect(g1.content).toBe("Hello!");
      expect(g1.parentLocalId).toBe(0);

      const g2 = msgs.find((m) => m.localId === 2)!;
      expect(g2.role).toBe("assistant");
      expect(g2.content).toBe("Hey there!");
      expect(g2.parentLocalId).toBe(0);
    });

    it("throws when greetings is empty", () => {
      expect(() =>
        createChat(userId, {
          characterId: charId,
          title: "Empty",
          greetings: [],
        }, db),
      ).toThrow("at least one greeting is required");
    });

    it("includes character field overrides", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "With Overrides",
        greetings: ["Hi"],
        characterDescription: "Custom desc",
        characterPersonality: "Brave",
        characterScenario: "At the castle",
        characterSystemPrompt: "Speak like a knight",
      }, db);

      expect(chat.characterDescription).toBe("Custom desc");
      expect(chat.characterPersonality).toBe("Brave");
      expect(chat.characterScenario).toBe("At the castle");
      expect(chat.characterSystemPrompt).toBe("Speak like a knight");
    });
  });

  describe("getChat", () => {
    it("returns chat detail", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "My Chat",
        greetings: ["Hi"],
      }, db);

      const detail = getChat(userId, chat.id, db);
      expect(detail.title).toBe("My Chat");
      expect(detail.characterId).toBe(charId);
    });

    it("throws on wrong user", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "My Chat",
        greetings: ["Hi"],
      }, db);

      expect(() => getChat("other-user", chat.id, db)).toThrow("Chat not found");
    });
  });

  describe("getMessages", () => {
    it("returns all messages ordered by localId", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Greeting"],
      }, db);

      const msgs = getMessages(userId, chat.id, db);
      expect(msgs).toHaveLength(2); // root + 1 greeting
      expect(msgs[0]!.localId).toBe(0);
      expect(msgs[1]!.localId).toBe(1);
    });
  });

  describe("getActivePath", () => {
    it("returns path filtering system root", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["First", "Second"],
      }, db);

      const path = getActivePath(userId, chat.id, db);
      expect(path).toHaveLength(1);
      expect(path[0]!.message.localId).toBe(1); // first_mes selected by default
      expect(path[0]!.message.role).toBe("assistant");
      expect(path[0]!.siblingTotal).toBe(2);
      expect(path[0]!.siblingIndex).toBe(0);
    });
  });

  describe("appendMessage", () => {
    it("appends a child to the active leaf", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hello"],
      }, db);

      const msg = appendMessage(userId, chat.id, {
        role: "user",
        content: "How are you?",
      }, db);

      expect(msg.role).toBe("user");
      expect(msg.content).toBe("How are you?");
      expect(msg.parentLocalId).toBe(1); // child of greeting 1

      // Verify DB state
      const parent = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 1))
        .get()!;
      expect(parent.children).toEqual([msg.localId]);
      expect(parent.selectedChildLocalId).toBe(msg.localId);
    });
  });

  describe("appendUserAndReply", () => {
    it("appends user message and reply in correct order", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      const { userMessage, replyMessage } = appendUserAndReply(
        userId,
        chat.id,
        "Hello bot",
        "Hello human",
        undefined,
        db,
      );

      expect(userMessage.role).toBe("user");
      expect(userMessage.content).toBe("Hello bot");
      expect(userMessage.parentLocalId).toBe(1); // child of greeting

      expect(replyMessage.role).toBe("assistant");
      expect(replyMessage.content).toBe("Hello human");
      expect(replyMessage.parentLocalId).toBe(userMessage.localId); // child of user msg

      // Verify getNextId ordering: userMessage < replyMessage
      expect(userMessage.localId).toBeLessThan(replyMessage.localId);
    });

    it("includes reply extra when provided", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      const { replyMessage } = appendUserAndReply(
        userId,
        chat.id,
        "Hi",
        "",
        { isStreaming: true },
        db,
      );

      expect(replyMessage.extra).toEqual({ isStreaming: true });
    });

    it("throws on empty user content", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      expect(() =>
        appendUserAndReply(userId, chat.id, "", "reply", undefined, db),
      ).toThrow("User content cannot be empty");
    });
  });

  describe("swipe", () => {
    it("navigates to next sibling", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["First", "Second"],
      }, db);

      const result = swipe(userId, chat.id, 1, "next", undefined, db);
      expect(result.selectedMessage.localId).toBe(2);
      expect(result.created).toBe(false);

      // Root's selection should be updated
      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
      expect(root.selectedChildLocalId).toBe(2);
    });

    it("navigates to previous sibling", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["First", "Second", "Third"],
      }, db);

      // Select greeting 3 first (from greeting 2)
      swipe(userId, chat.id, 2, "next", undefined, db);
      // Now swipe back to greeting 2
      const result = swipe(userId, chat.id, 3, "prev", undefined, db);
      expect(result.selectedMessage.localId).toBe(2);
      expect(result.created).toBe(false);
    });

    it("creates new sibling when no next exists and createIfMissing provided", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Only one"],
      }, db);

      const result = swipe(userId, chat.id, 1, "next", {
        role: "assistant",
        content: "New greeting",
      }, db);

      expect(result.created).toBe(true);
      expect(result.selectedMessage.content).toBe("New greeting");

      // Root should have 2 children now
      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
      expect(root.children).toEqual([1, result.selectedMessage.localId]);
      expect(root.selectedChildLocalId).toBe(result.selectedMessage.localId);
    });

    it("returns current message when no next sibling and no createIfMissing", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Only one"],
      }, db);

      const result = swipe(userId, chat.id, 1, "next", undefined, db);
      expect(result.created).toBe(false);
      expect(result.selectedMessage.localId).toBe(1);
    });

    it("no-ops on prev with no sibling (defensive)", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["First"],
      }, db);

      const result = swipe(userId, chat.id, 1, "prev", undefined, db);
      expect(result.created).toBe(false);
      expect(result.selectedMessage.localId).toBe(1);
    });
  });

  describe("deleteBranch", () => {
    it("deletes a leaf node and re-points parent selection", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["First", "Second"],
      }, db);

      const { deletedIds } = deleteBranch(userId, chat.id, 1, db);
      expect(deletedIds).toEqual([1]);

      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
      expect(root.children).toEqual([2]);
      expect(root.selectedChildLocalId).toBe(2);
    });

    it("deletes a subtree with descendants", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      // Add user message + reply
      appendUserAndReply(userId, chat.id, "Hello", "Hi back", undefined, db);

      // Delete the user message: should delete user message + reply
      const { deletedIds } = deleteBranch(userId, chat.id, 2, db); // localId 2 is user msg
      expect(deletedIds).toHaveLength(2); // user msg + reply

      // Greeting should have no children now
      const greeting = db.select().from(chatMessages).where(eq(chatMessages.localId, 1)).get()!;
      expect(greeting.children).toEqual([]);
      expect(greeting.selectedChildLocalId).toBeNull();
    });

    it("throws on localId 0", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      expect(() => deleteBranch(userId, chat.id, 0, db)).toThrow("hidden root");
    });
  });

  describe("editMessage", () => {
    it("updates content without changing structure", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Original"],
      }, db);

      editMessage(userId, chat.id, 1, "Edited!", db);

      const msg = db.select().from(chatMessages).where(eq(chatMessages.localId, 1)).get()!;
      expect(msg.content).toBe("Edited!");
      expect(msg.role).toBe("assistant");
      expect(msg.parentLocalId).toBe(0);
      expect(msg.children).toEqual([]);
    });

    it("throws on localId 0", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      expect(() => editMessage(userId, chat.id, 0, "x", db)).toThrow("hidden root");
    });

    it("throws on missing message", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      expect(() => editMessage(userId, chat.id, 999, "x", db)).toThrow("Message not found");
    });

  });

  describe("deleteChat", () => {
    it("deletes a chat and all its messages", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      deleteChat(userId, chat.id, db);

      expect(() => getChat(userId, chat.id, db)).toThrow("Chat not found");

      const remaining = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, chat.id))
        .all();
      expect(remaining).toHaveLength(0);
    });

    it("throws on wrong user", () => {
      const chat = createChat(userId, {
        characterId: charId,
        title: "Test",
        greetings: ["Hi"],
      }, db);

      expect(() => deleteChat("other-user", chat.id, db)).toThrow("Chat not found");
    });
  });
});
