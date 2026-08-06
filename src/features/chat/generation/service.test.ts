import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters, chatMessages, aiProviders, userSettings, personas } from "@/db/schema";
import {
  createChat,
  appendMessage,
  appendUserAndReply,
  appendSibling,
  swipe,
} from "../tree/service";
import { acquireGenerationLock } from "../tree/lock";
import { prepareStream, finalizeStream, cancelStream } from "./service";
import { impersonateMessage } from "./impersonate";
import { generateImagePrompt, DEFAULT_IMAGE_PROMPT_EXAMPLE } from "./image-prompt";

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
      const result = prepareStream(
        userId,
        { chatId, mode: "send", content: "Hi" },
        "Test User",
        db,
      );

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

      const reply = db.select().from(chatMessages).where(eq(chatMessages.localId, localId)).get()!;
      expect(reply.content).toBe("");
      expect(reply.extra).toEqual({ isStreaming: true });

      const chat = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
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

      prepareStream(userId, { chatId, mode: "send", content: "I am {{user}}" }, "Test User", db);

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
      const result = prepareStream(
        userId,
        { chatId, mode: "send", content: "Hi" },
        "Test User",
        db,
      );

      expect(result.mode).toBe("fallback");
      const localId = (result as { mode: "fallback"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

      const reply = db.select().from(chatMessages).where(eq(chatMessages.localId, localId)).get()!;
      expect(reply.content.length).toBeGreaterThan(0);
      expect(reply.extra).toBeNull();

      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
      expect(root.extra).toBeNull();
    });
  });

  // ── regenerate mode ────────────────────────────────────────────────────────

  describe("prepareStream regenerate", () => {
    it("creates sibling at the end and acquires lock", () => {
      seedProvider();

      appendUserAndReply(userId, chatId, "Hi", "First reply", undefined, db);
      const existingSibling = appendSibling(
        userId,
        chatId,
        3,
        { role: "assistant", content: "Existing sibling" },
        db,
      );

      const result = prepareStream(
        userId,
        { chatId, mode: "regenerate", messageLocalId: 3 },
        "Test User",
        db,
      );

      expect(result.mode).toBe("stream");
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;
      const allIds = [3, existingSibling.localId, localId];

      const userMsg = db.select().from(chatMessages).where(eq(chatMessages.localId, 2)).get()!;
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
        prepareStream(userId, { chatId, mode: "regenerate", messageLocalId: 2 }, "Test User", db),
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
        userId,
        chatId,
        "Hi",
        "",
        { isStreaming: true },
        db,
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
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

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
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
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
      const result = prepareStream(
        userId,
        { chatId, mode: "send", content: "Hi" },
        "Test User",
        db,
      );
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

      const finalized = finalizeStream(
        userId,
        chatId,
        localId,
        "Final {{char}} message",
        "Test User",
        db,
      );

      expect(finalized.messageLocalId).toBe(localId);
      expect(finalized.content).toBe(`Final ${charName} message`);

      const msg = db.select().from(chatMessages).where(eq(chatMessages.localId, localId)).get()!;
      expect(msg.content).toBe(`Final ${charName} message`);
      expect(msg.extra).toBeNull();

      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
      expect((root.extra as any)?.lock).toBeUndefined();
    });

    it("throws on root", () => {
      seedProvider();
      expect(() => finalizeStream(userId, chatId, 0, "x", "Test User", db)).toThrow("root");
    });

    it("throws on non-streaming message", () => {
      seedProvider();
      expect(() => finalizeStream(userId, chatId, 1, "x", "Test User", db)).toThrow(
        "not a streaming placeholder",
      );
    });
  });

  // ── cancelStream ───────────────────────────────────────────────────────────

  describe("cancelStream", () => {
    it("deletes placeholder and releases lock", () => {
      seedProvider();
      const result = prepareStream(
        userId,
        { chatId, mode: "send", content: "Hi" },
        "Test User",
        db,
      );
      const localId = (result as { mode: "stream"; assistantMessageLocalId: number })
        .assistantMessageLocalId;

      const cancelResult = cancelStream(userId, chatId, localId, db);
      expect(cancelResult.deletedIds).toContain(localId);

      const msg = db.select().from(chatMessages).where(eq(chatMessages.localId, localId)).get();
      expect(msg).toBeUndefined();

      const root = db.select().from(chatMessages).where(eq(chatMessages.localId, 0)).get()!;
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

      const result = await impersonateMessage(
        userId,
        chatId,
        "Test User",
        { fetchFn: mockFetch as any },
        db,
      );

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

  // ── image prompt ───────────────────────────────────────────────────────────

  describe("generateImagePrompt", () => {
    function mockImagePromptFetch(content = "masterpiece, best quality, 1girl") {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
        text: async () => "",
      } as unknown as Response);
      return mockFetch;
    }

    it("sends the expected request shape (model, system-first messages, stream: false)", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe("http://localhost:11434/chat/completions");
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toBe("Bearer test-key");

      const body = JSON.parse(init.body as string);
      expect(body.model).toBe("test-model");
      expect(body.stream).toBe(false);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("system");
      expect(body.messages[2].role).toBe("user");
      expect(body.messages).toHaveLength(3);
    });

    it("uses custom imagePromptExample from settings in the instruction", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);
      db.update(userSettings)
        .set({ imagePromptExample: "custom example, 1boy, watercolor" })
        .where(eq(userSettings.userId, userId))
        .run();
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.messages[0].content).toContain("custom example, 1boy, watercolor");
      expect(body.messages[0].content).not.toContain(DEFAULT_IMAGE_PROMPT_EXAMPLE);
    });

    it("falls back to DEFAULT_IMAGE_PROMPT_EXAMPLE when the setting is null", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.messages[0].content).toContain(DEFAULT_IMAGE_PROMPT_EXAMPLE);
    });

    it("includes the character base (name, description, personality, tags) verbatim", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      const characterBlock = body.messages[1];
      expect(characterBlock.role).toBe("system");
      expect(characterBlock.content).toContain("Test Character: A test character");
      expect(characterBlock.content).toContain("Personality: Cheerful");
      expect(characterBlock.content).toContain("Tags: test");
      expect(characterBlock.content).not.toContain("A test scenario");
      expect(characterBlock.content).not.toContain("Scenario:");
    });

    it("limits the scene to the last 10 history messages", async () => {
      seedProvider();
      for (let i = 1; i <= 8; i++) {
        appendUserAndReply(userId, chatId, `user ${i}`, `reply ${i}`, undefined, db);
      }
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db);

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      const sceneMessage = body.messages.find((m: { role: string }) => m.role === "user");
      expect(sceneMessage.content).toContain("Current scene: ");
      const sceneLines = sceneMessage.content.replace("Current scene: ", "").split("\n");
      expect(sceneLines).toHaveLength(10);
      expect(sceneMessage.content).toContain("user 4");
      expect(sceneMessage.content).toContain("reply 8");
      expect(sceneMessage.content).not.toContain("user 3");
      expect(sceneMessage.content).not.toContain("Hello!");
    });

    it("falls back to character.scenario as the scene on an empty conversation", async () => {
      seedProvider();
      const emptyChat = createChat(
        userId,
        { characterId: charId, title: "Empty", greetings: [""] },
        db,
      );
      const mockFetch = mockImagePromptFetch();

      await generateImagePrompt(
        userId,
        emptyChat.id,
        "Test User",
        { fetchFn: mockFetch as any },
        db,
      );

      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      const sceneMessage = body.messages.find((m: { role: string }) => m.role === "user");
      expect(sceneMessage.content).toBe("Current scene: A test scenario");
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
        generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db),
      ).rejects.toThrow("Provider returned 401");
    });

    it("throws when no provider is configured", async () => {
      const mockFetch = mockImagePromptFetch();

      await expect(
        generateImagePrompt(userId, chatId, "Test User", { fetchFn: mockFetch as any }, db),
      ).rejects.toThrow("No provider configured");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns text parsed from choices[0].message.content", async () => {
      seedProvider();
      appendUserAndReply(userId, chatId, "Hello", "Hi there!", undefined, db);
      const mockFetch = mockImagePromptFetch("masterpiece, 1girl, sunset");

      const result = await generateImagePrompt(
        userId,
        chatId,
        "Test User",
        { fetchFn: mockFetch as any },
        db,
      );

      expect(result).toEqual({ text: "masterpiece, 1girl, sunset" });
    });
  });
});
