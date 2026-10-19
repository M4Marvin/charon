import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CharacterDataV2 } from "@/lib/st-core/character/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { makeLorebookConfig, makeLoreEntry } from "@/db/__tests__/lorebook-data";
import { makeTestDb, type TestDb } from "@/db/__tests__/helpers";
import { characters, chatMessages, chats, lorebooks, loreEntries } from "@/db/schema";
import { appendUserAndReply, createChat, swipe } from "@/features/chat/tree/service";
import type { ToolContext } from "./contract";
import {
  CHARACTER_TEXT_CAP,
  LORE_CONTENT_CAP,
  SCENE_CONTENT_CAP,
  buildCharacterView,
  buildScene,
  createReadTools,
  filterLoreEntries,
  normalizeQueryTerms,
  readTools,
} from "./tools";

function runtime(chatId: string, overrides: Partial<ToolContext> = {}) {
  const context: ToolContext = {
    userId: "user-1",
    chatId,
    ...overrides,
  };
  return { context, emitCustomEvent: () => {} };
}

function seedCharacter(db: TestDb, overrides: Partial<CharacterDataV2> = {}) {
  const data = makeCharacterData(overrides);
  const id = "char-1";
  db.insert(characters)
    .values({
      id,
      name: data.name,
      data,
      spec: "chara_card_v2",
      specVersion: "2.0",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  return { id, data };
}

function seedLorebook(
  db: TestDb,
  options: { id?: string; enabled?: boolean; entries: LoreEntry[] },
) {
  const id = options.id ?? "lb-1";
  db.insert(lorebooks)
    .values({
      id,
      name: id,
      config: makeLorebookConfig(),
      enabled: options.enabled === false ? 0 : 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  options.entries.forEach((entry, index) => {
    db.insert(loreEntries)
      .values({
        id: `${id}-entry-${index}`,
        lorebookId: id,
        uid: entry.uid,
        data: entry,
        userDisabled: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  });
}

function seedChat(
  db: TestDb,
  chatOverrides: Partial<{
    characterDescription: string;
    characterPersonality: string;
    characterScenario: string;
    characterSystemPrompt: string;
  }> = {},
  characterOverrides: Partial<CharacterDataV2> = {},
) {
  const character = seedCharacter(db, characterOverrides);
  const chat = createChat(
    {
      characterId: character.id,
      title: "Test Chat",
      greetings: ["Hello!"],
      ...chatOverrides,
    },
    db,
  );
  return { chat, character };
}

function jsonSchema(schema: unknown, direction: "input" | "output"): Record<string, unknown> {
  const standard = (
    schema as {
      "~standard": {
        jsonSchema: Record<
          "input" | "output",
          (options: { target: string }) => Record<string, unknown>
        >;
      };
    }
  )["~standard"];
  return standard.jsonSchema[direction]({ target: "draft-2020-12" });
}

describe("generation read tools", () => {
  let db: TestDb;
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  describe("tool definitions", () => {
    it("exposes the three server tools with JSON Schemas", () => {
      expect(readTools.map((tool) => tool.name)).toEqual([
        "read_lore",
        "read_character",
        "read_scene",
      ]);

      const input = jsonSchema(readTools[0].inputSchema, "input");
      expect(input.type).toBe("object");
      expect(input.required).toEqual(["query"]);
      expect(input.properties).toMatchObject({ query: { type: "string" } });

      const output = jsonSchema(readTools[0].outputSchema, "output");
      expect(output.type).toBe("object");
      expect(output.properties).toHaveProperty("entries");
    });

    it("converts the character schema to an optional-field object", () => {
      const output = jsonSchema(readTools[1].outputSchema, "output");
      expect(output.properties).toMatchObject({
        name: { type: "string" },
        tags: { type: "array" },
      });
      expect(output.required ?? []).toEqual([]);
    });
  });

  describe("filterLoreEntries", () => {
    it("matches primary and secondary keys, case-insensitively", () => {
      const entries = [
        makeLoreEntry({ uid: 1, key: ["Dragon"], keysecondary: ["wyrm"] }),
        makeLoreEntry({ uid: 2, key: ["sword"], content: "A dragon-slaying sword." }),
        makeLoreEntry({ uid: 3, key: ["potion"], content: "Healing draught." }),
      ];

      expect(filterLoreEntries(entries, "dragon").map((entry) => entry.id)).toEqual([1, 2]);
      expect(filterLoreEntries(entries, "WYRM").map((entry) => entry.id)).toEqual([1]);
      expect(filterLoreEntries(entries, "missing")).toEqual([]);
    });

    it("caps count and content and drops empty terms", () => {
      const entries = [
        makeLoreEntry({
          uid: 1,
          key: ["ancient"],
          content: "x".repeat(LORE_CONTENT_CAP + 500),
        }),
        makeLoreEntry({ uid: 2, key: ["ancient"] }),
        makeLoreEntry({ uid: 3, key: ["ancient"] }),
      ];

      const result = filterLoreEntries(entries, "ancient", 2);
      expect(result).toHaveLength(2);
      expect(result[0].content.length).toBeLessThanOrEqual(LORE_CONTENT_CAP);
      expect(result[0].content.endsWith("…")).toBe(true);
      expect(filterLoreEntries(entries, "   ", 2)).toEqual([]);
      expect(normalizeQueryTerms(" Ancient, ancient  dragon ")).toEqual(["ancient", "dragon"]);
    });
  });

  describe("read_lore", () => {
    it("reads only enabled entries from enabled lorebooks", async () => {
      const { chat } = seedChat(db);
      seedLorebook(db, {
        entries: [
          makeLoreEntry({ uid: 1, key: ["dragon"], content: "Dragons breathe fire." }),
          makeLoreEntry({ uid: 2, key: ["sword"], content: "Swords are sharp." }),
        ],
      });
      seedLorebook(db, {
        id: "lb-disabled",
        enabled: false,
        entries: [makeLoreEntry({ uid: 3, key: ["dragon"], content: "Disabled book." })],
      });

      const tools = createReadTools({ db });
      const result = await tools.readLore.execute!({ query: "dragon" }, runtime(chat.id));

      expect(result.entries).toEqual([
        { id: 1, keys: ["dragon"], content: "Dragons breathe fire." },
      ]);
    });

    it("validates the chat and query without writing", async () => {
      const { chat } = seedChat(db);
      const tools = createReadTools({ db });
      const before = {
        chats: db.select().from(chats).all().length,
        messages: db.select().from(chatMessages).all().length,
        entries: db.select().from(loreEntries).all().length,
      };

      await expect(
        tools.readLore.execute!({ query: "  " }, runtime(chat.id)),
      ).rejects.toMatchObject({ _tag: "GenerationValidationError" });

      await expect(
        tools.readLore.execute!({ query: "dragon" }, runtime("missing-chat")),
      ).rejects.toMatchObject({ _tag: "GenerationValidationError", field: "chatId" });

      expect({
        chats: db.select().from(chats).all().length,
        messages: db.select().from(chatMessages).all().length,
        entries: db.select().from(loreEntries).all().length,
      }).toEqual(before);
    });
  });

  describe("read_character", () => {
    it("prefers chat overrides and selects requested fields", async () => {
      const { chat } = seedChat(
        db,
        {
          characterDescription: "Chat description",
          characterPersonality: "",
          characterScenario: "",
          characterSystemPrompt: "",
        },
        {
          name: "Card Name",
          description: "Card description",
          personality: "Card personality",
          scenario: "Card scenario",
          system_prompt: "Card system prompt",
          tags: ["tag-a", "tag-b"],
        },
      );
      const tools = createReadTools({ db });

      const all = await tools.readCharacter.execute!({}, runtime(chat.id));
      expect(all).toEqual({
        name: "Card Name",
        description: "Chat description",
        personality: "Card personality",
        scenario: "Card scenario",
        systemPrompt: "Card system prompt",
        tags: ["tag-a", "tag-b"],
      });

      const subset = await tools.readCharacter.execute!(
        { fields: ["name", "tags"] },
        runtime(chat.id),
      );
      expect(subset).toEqual({ name: "Card Name", tags: ["tag-a", "tag-b"] });
      expect(Object.keys(subset).sort()).toEqual(["name", "tags"]);

      const empty = await tools.readCharacter.execute!({ fields: [] }, runtime(chat.id));
      expect(empty).toEqual(all);
    });

    it("caps long fields and rejects a missing chat", async () => {
      const { chat } = seedChat(db, {}, { description: "d".repeat(CHARACTER_TEXT_CAP + 300) });
      const tools = createReadTools({ db });

      const result = await tools.readCharacter.execute!(
        { fields: ["description"] },
        runtime(chat.id),
      );
      expect(result.description!.length).toBeLessThanOrEqual(CHARACTER_TEXT_CAP);
      expect(result.description!.endsWith("…")).toBe(true);

      await expect(tools.readCharacter.execute!({}, runtime("missing-chat"))).rejects.toMatchObject(
        { _tag: "GenerationValidationError", field: "chatId" },
      );
    });
  });

  describe("read_scene", () => {
    it("reads the newest messages on the active path, excluding the root", async () => {
      const { chat } = seedChat(db);
      appendUserAndReply(chat.id, "Hi", "Hey there", undefined, db);
      const tools = createReadTools({ db });

      const result = await tools.readScene.execute!({ limit: 2 }, runtime(chat.id));

      expect(result.messages.map((message) => message.localId)).toEqual([2, 3]);
      expect(result.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(result.messages.map((message) => message.content)).toEqual(["Hi", "Hey there"]);
    });

    it("follows the selected sibling and caps scene content", async () => {
      const { chat } = seedChat(db);
      swipe(chat.id, 1, "next", { role: "assistant", content: "Alt greeting" }, db);
      appendUserAndReply(chat.id, "x".repeat(SCENE_CONTENT_CAP + 500), "Done", undefined, db);
      const tools = createReadTools({ db });

      const result = await tools.readScene.execute!({ limit: 2 }, runtime(chat.id));
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content.length).toBeLessThanOrEqual(SCENE_CONTENT_CAP);
      expect(result.messages[0].content.endsWith("…")).toBe(true);
      expect(result.messages[1]).toEqual({ localId: 4, role: "assistant", content: "Done" });
    });

    it("rejects a missing chat without writing", async () => {
      const tools = createReadTools({ db });
      await expect(tools.readScene.execute!({}, runtime("missing-chat"))).rejects.toMatchObject({
        _tag: "GenerationValidationError",
      });
      expect(db.select().from(chatMessages).all()).toEqual([]);
    });
  });

  describe("pure helpers", () => {
    it("builds a scene from an explicit active branch", () => {
      const messages = [
        {
          localId: 0,
          parentLocalId: null,
          children: [1],
          selectedChildLocalId: 1,
          role: "system" as const,
          content: "",
        },
        {
          localId: 1,
          parentLocalId: 0,
          children: [2, 3],
          selectedChildLocalId: 3,
          role: "assistant" as const,
          content: "Old greeting",
        },
        {
          localId: 2,
          parentLocalId: 1,
          children: [],
          selectedChildLocalId: null,
          role: "assistant" as const,
          content: "Unselected branch",
        },
        {
          localId: 3,
          parentLocalId: 1,
          children: [],
          selectedChildLocalId: null,
          role: "user" as const,
          content: "Selected branch",
        },
      ];

      expect(buildScene(messages, 1)).toEqual([
        { localId: 3, role: "user", content: "Selected branch" },
      ]);
    });

    it("builds a capped character view from config shapes", () => {
      const view = buildCharacterView({
        chat: {
          characterDescription: "",
          characterPersonality: "",
          characterScenario: "",
          characterSystemPrompt: "",
        },
        character: makeCharacterData({ description: "d".repeat(CHARACTER_TEXT_CAP + 10) }),
      });
      expect(view.description!.length).toBeLessThanOrEqual(CHARACTER_TEXT_CAP);
      expect(view.name).toBe("Test Character");
    });
  });
});
