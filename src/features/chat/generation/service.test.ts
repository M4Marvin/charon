import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters, chatMessages, aiProviders, userSettings, personas } from "@/db/schema";
import { createChat, appendMessage, appendUserAndReply, appendSibling, swipe } from "../tree/service";
import { acquireGenerationLock } from "../tree/lock";
import { prepareStream, finalizeStream, cancelStream } from "./service";
import { impersonateMessage } from "./impersonate";

describe("generation service", () => {
  let db: TestDb;
  let userId: string;
  let charId: string;
  let chatId: string;
  let charName: string;

  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    const data = makeCharacterData();
    charName = data.name;
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
    const chat = createChat(
      userId,
      { characterId: charId, title: "Test", greetings: ["Hello!"] },
      db,
    );
    chatId = chat.id;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function seedProvider(): void {
    db.insert(aiProviders)
      .values({
        id: "prov-1",
        userId,
        name: "Test",
        baseUrl: "http://localhost:11434",
        apiKey: "test-key",
        defaultModel: "test-model",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(userSettings)
      .values({
        userId,
        defaultProviderId: "prov-1",
        defaultSelectedModel: "test-model",
      })
      .run();
  }

  // ── send mode ──────────────────────────────────────────────────────────────

  describe("prepareStream send", () => {
    it("creates user + placeholder, acquires lock (stream mode)", () => {
      seedProvider();
      const result = prepareStream(userId, { chatId, mode: "send", content: "Hi" }, "Test User", db);

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const reply = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get()!;
      expect(reply.content).toBe("");
      expect(reply.extra).toEqual({ isStreaming: true });

      const chat = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 0))
        .get()!;
      expect((chat.extra as any)?.lock).toBe("generating");
      expect((chat.extra as any)?.messageId).toBe(localId);
    });

    it("substitutes {{char}} and {{user}} macros", () => {
      seedProvider();
      prepareStream(
        userId,
        { chatId, mode: "send", content: "Hello {{char}}, I am {{user}}" },
        "Test User",
        db,
      );

      const userMsg = db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.parentLocalId, 1), eq(chatMessages.role, "user")))
        .get()!;
      expect(userMsg.content).toBe(`Hello ${charName}, I am Test User`);
    });

    it("uses persona name for {{user}} when persona is set", () => {
      seedProvider();
      db.insert(personas)
        .values({ id: "persona-1", userId, name: "PersonaName", description: "desc" })
        .run();
      db.update(userSettings)
        .set({ defaultPersonaId: "persona-1" })
        .where(eq(userSettings.userId, userId))
        .run();

      prepareStream(
        userId,
        { chatId, mode: "send", content: "I am {{user}}" },
        "Test User",
        db,
      );

      const userMsg = db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.parentLocalId, 1), eq(chatMessages.role, "user")))
        .get()!;
      expect(userMsg.content).toBe("I am PersonaName");
    });

    it("throws on empty content", () => {
      seedProvider();
      expect(() =>
        prepareStream(userId, { chatId, mode: "send", content: "" }, "Test User", db),
      ).toThrow("Content is required");
    });

    it("returns fallback when no provider configured", () => {
      // No seedProvider — no providerId in settings
      const result = prepareStream(userId, { chatId, mode: "send", content: "Hi" }, "Test User", db);

      expect(result.mode).toBe("fallback");
      const localId = (result as { mode: "fallback"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const reply = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get()!;
      expect(reply.content.length).toBeGreaterThan(0);
      expect(reply.extra).toBeNull();

      const root = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 0))
        .get()!;
      expect(root.extra).toBeNull();
    });
  });

  // ── regenerate mode ────────────────────────────────────────────────────────

  describe("prepareStream regenerate", () => {
    it("creates sibling at the end and acquires lock", () => {
      seedProvider();

      appendUserAndReply(userId, chatId, "Hi", "First reply", undefined, db);
      const existingSibling = appendSibling(
        userId, chatId, 3,
        { role: "assistant", content: "Existing sibling" }, db,
      );

      const result = prepareStream(
        userId,
        { chatId, mode: "regenerate", messageLocalId: 3 },
        "Test User",
        db,
      );

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;
      const allIds = [3, existingSibling.localId, localId];

      const userMsg = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 2))
        .get()!;
      expect(userMsg.children).toEqual(allIds);
      expect(userMsg.selectedChildLocalId).toBe(localId);

      const placeholder = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get()!;
      expect(placeholder.role).toBe("assistant");
      expect(placeholder.content).toBe("");
      expect(placeholder.extra).toEqual({ isStreaming: true });
    });

    it("throws on user message", () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hi", "Reply", undefined, db);
      expect(() =>
        prepareStream(
          userId,
          { chatId, mode: "regenerate", messageLocalId: 2 },
          "Test User",
          db,
        ),
      ).toThrow("assistant");
    });

    it("throws on root message", () => {
      seedProvider();
      expect(() =>
        prepareStream(userId, { chatId, mode: "regenerate", messageLocalId: 0 }, "Test User", db),
      ).toThrow("root");
    });

    it("throws when locked", () => {
      seedProvider();
      const { replyMessage } = appendUserAndReply(
        userId, chatId, "Hi", "", { isStreaming: true }, db,
      );
      acquireGenerationLock(userId, chatId, replyMessage.localId, db);
      expect(() =>
        prepareStream(
          userId,
          { chatId, mode: "regenerate", messageLocalId: replyMessage.localId },
          "Test User",
          db,
        ),
      ).toThrow();
    });
  });

  // ── continue mode ─────────────────────────────────────────────────────────

  describe("prepareStream continue", () => {
    it("from user leaf: creates assistant child and acquires lock", () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hi", "Reply", undefined, db);
      // Active leaf = reply(3). Append a user message to make user the active leaf:
      appendMessage(userId, chatId, { role: "user", content: "Tell me more" }, db);
      // Active leaf = user(4)

      const result = prepareStream(userId, { chatId, mode: "continue" }, "Test User", db);

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const placeholder = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get()!;
      expect(placeholder.role).toBe("assistant");
      expect(placeholder.parentLocalId).toBe(4);
      expect(placeholder.extra).toEqual({ isStreaming: true });
    });

    it("from assistant leaf with existing next sibling: creates at end", () => {
      seedProvider();

      // greeting(1). Active = 1. Create sibling: children = [1, 2], selected = 2.
      swipe(userId, chatId, 1, "next", { role: "assistant", content: "Reply 2" }, db);
      // Select original greeting: children = [1, 2], selected = 1.
      swipe(userId, chatId, 2, "prev", undefined, db);

      const result = prepareStream(userId, { chatId, mode: "continue" }, "Test User", db);

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const root = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 0))
        .get()!;
      expect(root.children).toEqual([1, 2, localId]);
      expect(root.selectedChildLocalId).toBe(localId);
    });
  });

  // ── lock guard ─────────────────────────────────────────────────────────────

  describe("prepareStream rejects when locked", () => {
    it("throws for send mode when chat is locked", () => {
      seedProvider();
      acquireGenerationLock(userId, chatId, 1, db);

      expect(() =>
        prepareStream(userId, { chatId, mode: "send", content: "Hi" }, "Test User", db),
      ).toThrow();
    });
  });

  // ── finalizeStream ─────────────────────────────────────────────────────────

  describe("finalizeStream", () => {
    it("writes content, applies macros, clears extra, releases lock", () => {
      seedProvider();
      const result = prepareStream(userId, { chatId, mode: "send", content: "Hi" }, "Test User", db);
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const finalized = finalizeStream(
        userId, chatId, localId,
        "Final {{char}} message", "Test User", db,
      );

      expect(finalized.messageLocalId).toBe(localId);
      expect(finalized.content).toBe(`Final ${charName} message`);

      const msg = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get()!;
      expect(msg.content).toBe(`Final ${charName} message`);
      expect(msg.extra).toBeNull();

      const root = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 0))
        .get()!;
      expect((root.extra as any)?.lock).toBeUndefined();
    });

    it("throws on root", () => {
      seedProvider();
      expect(() =>
        finalizeStream(userId, chatId, 0, "x", "Test User", db),
      ).toThrow("root");
    });

    it("throws on non-streaming message", () => {
      seedProvider();
      expect(() =>
        finalizeStream(userId, chatId, 1, "x", "Test User", db),
      ).toThrow("not a streaming placeholder");
    });
  });

  // ── cancelStream ───────────────────────────────────────────────────────────

  describe("cancelStream", () => {
    it("deletes placeholder and releases lock", () => {
      seedProvider();
      const result = prepareStream(userId, { chatId, mode: "send", content: "Hi" }, "Test User", db);
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number }).assistantMessageLocalId;

      const cancelResult = cancelStream(userId, chatId, localId, db);
      expect(cancelResult.deletedIds).toContain(localId);

      const msg = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, localId))
        .get();
      expect(msg).toBeUndefined();

      const root = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.localId, 0))
        .get()!;
      expect((root.extra as any)?.lock).toBeUndefined();
    });

    it("throws on root", () => {
      expect(() => cancelStream(userId, chatId, 0, db)).toThrow("root");
    });
  });

  // ── impersonation ──────────────────────────────────────────────────────────

  describe("impersonateMessage", () => {
    it("returns text from mock fetch", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);

      const mockFetch = vi.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "I walked into the room." } }] }),
        text: async () => "",
      } as unknown as Response);

      const result = await impersonateMessage(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      expect(result).toEqual({ text: "I walked into the room." });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const fetchCall = mockFetch.mock.calls[0]!;
      const url = fetchCall[0] as string;
      expect(url).toContain("/chat/completions");

      const init = fetchCall[1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(false);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toContain("Write Test User's next message");
      expect(body.model).toBe("test-model");
    });

    it("uses custom impersonationPrompt from settings", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);

      db.update(userSettings)
        .set({ impersonationPrompt: "Pretend to be {{user}} today." })
        .where(eq(userSettings.userId, userId))
        .run();

      const mockFetch = vi.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        text: async () => "",
      } as unknown as Response);

      await impersonateMessage(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.messages[0].content).toBe("Pretend to be Test User today.");
    });

    it("throws on provider error", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);

      const mockFetch = vi.fn();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as unknown as Response);

      await expect(
        impersonateMessage(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db),
      ).rejects.toThrow("Provider returned 401");
    });
  });
});
