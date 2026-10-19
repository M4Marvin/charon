import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import type { UserSettingsView, PersonaInfo } from "@/features/chat/config/types";
import { DEFAULT_LORE_ENTRY } from "@/lib/st-core/lorebook/types";
import type { LoreEntry } from "@/lib/st-core/lorebook/types";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { ApproxTokenCounter } from "@/lib/st-core/shared/tokens.js";
import type { EffectiveCharacter, GenerationSnapshot } from "./contract";
import { compilePrompt } from "./prompt";
import { ContextOverflowError } from "./errors";

const DEFAULT_SETTINGS: UserSettingsView = {
  defaultProviderId: null,
  defaultPresetId: null,
  defaultSelectedModel: null,
  defaultPersonaId: null,
  systemPrompt: null,
  postHistoryInstructions: null,
  impersonationPrompt: null,
  imagePromptExample: null,
};

const DEFAULT_CHARACTER: EffectiveCharacter = {
  name: "Alice",
  description: "",
  personality: "",
  scenario: "",
  systemPrompt: "",
  mesExample: "",
  postHistoryInstructions: "",
  depthPrompt: "",
  tags: [],
};

const DEFAULT_PERSONA: PersonaInfo = { name: "Marv" };

type SnapshotOverrides = Omit<Partial<GenerationSnapshot>, "character" | "persona" | "settings"> & {
  character?: Partial<EffectiveCharacter>;
  persona?: Partial<PersonaInfo>;
  settings?: Partial<UserSettingsView>;
};

function makeSnapshot(overrides: SnapshotOverrides = {}): GenerationSnapshot {
  const {
    character: characterOverrides,
    persona: personaOverrides,
    settings: settingsOverrides,
    ...rest
  } = overrides;

  return {
    chatId: "chat-1",
    character: { ...DEFAULT_CHARACTER, ...characterOverrides },
    persona: { ...DEFAULT_PERSONA, ...personaOverrides },
    path: [],
    loreEntries: [],
    preset: {},
    provider: {
      provider: { baseUrl: "http://localhost:1234", apiKey: "test-key" },
      model: "test-model",
      preset: {},
    },
    settings: { ...DEFAULT_SETTINGS, ...settingsOverrides },
    config: {} as GenerationSnapshot["config"],
    ...rest,
  };
}

function message(localId: number, role: ChatMessage["role"], content: string): ChatMessage {
  return {
    localId,
    parentLocalId: localId === 0 ? null : localId - 1,
    children: [],
    selectedChildLocalId: null,
    role,
    content,
  };
}

function loreEntry(overrides: Partial<LoreEntry> = {}): LoreEntry {
  return { ...DEFAULT_LORE_ENTRY, uid: 1, ...overrides };
}

function preset(overrides: Partial<ChatCompletionPreset> = {}): Partial<ChatCompletionPreset> {
  return overrides;
}

function systemText(result: ReturnType<typeof compilePrompt>): string {
  return result.systemPrompts.join("\n");
}

describe("compilePrompt", () => {
  describe("system prompts and macro expansion", () => {
    it("expands {{char}} and {{user}} in every authoring template", () => {
      const snapshot = makeSnapshot({
        character: {
          systemPrompt: "Roleplay as {{char}}.",
          description: "{{char}} is a pilot.",
          personality: "Calm around {{user}}.",
          scenario: "{{char}} and {{user}} meet at a bar.",
          depthPrompt: "Stay close to {{user}}.",
          postHistoryInstructions: "Never break character for {{user}}.",
          mesExample: "<START>\n{{user}}: Hello {{char}}.\n{{char}}: Hello {{user}}.",
        },
        settings: {
          systemPrompt: "Address {{user}} directly.",
          postHistoryInstructions: "Finish as {{char}}.",
        },
        preset: preset({
          utilityPrompts: ["Write {{char}}'s next reply to {{user}}."],
        }),
        loreEntries: [loreEntry({ content: "{{char}} hates {{user}}'s coffee." })],
        persona: { name: "Marv", description: "A tired engineer." },
      });

      const result = compilePrompt(snapshot, "chat");
      const systems = systemText(result);

      expect(systems).toContain("Address Marv directly.");
      expect(systems).toContain("Write Alice's next reply to Marv.");
      expect(systems).toContain("Roleplay as Alice.");
      expect(systems).toContain("Alice is a pilot.");
      expect(systems).toContain("Calm around Marv.");
      expect(systems).toContain("Alice and Marv meet at a bar.");
      expect(systems).toContain("Stay close to Marv.");
      expect(systems).toContain("Alice hates Marv's coffee.");
      expect(systems).toContain("Marv's persona: A tired engineer.");
      expect(systems).toContain("Finish as Alice.");
      expect(systems).not.toMatch(/\{\{char\}\}/i);
      expect(systems).not.toMatch(/\{\{user\}\}/i);

      expect(result.messages[0]).toEqual({ role: "user", content: "Hello Alice." });
      expect(result.messages[1]).toEqual({ role: "assistant", content: "Hello Marv." });
    });

    it("expands exactly once and does not cascade replacements", () => {
      const snapshot = makeSnapshot({
        character: { name: "{{user}}" },
        persona: { name: "Marv" },
        settings: { systemPrompt: "{{char}}" },
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.systemPrompts).toEqual(["{{user}}"]);
    });

    it("never macro-expands persisted message content", () => {
      const snapshot = makeSnapshot({
        character: { description: "{{char}}" },
        path: [message(1, "user", "I saw {{char}} and {{user}} yesterday.")],
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.messages).toEqual([
        { role: "user", content: "I saw {{char}} and {{user}} yesterday." },
      ]);
      expect(systemText(result)).toContain("Alice");
    });

    it("puts every system fragment in systemPrompts and never in messages", () => {
      const snapshot = makeSnapshot({
        character: {
          systemPrompt: "character system",
          description: "description",
          personality: "personality",
          scenario: "scenario",
          depthPrompt: "depth",
          postHistoryInstructions: "character post-history",
        },
        settings: { systemPrompt: "user system", postHistoryInstructions: "user post-history" },
        preset: preset({ utilityPrompts: ["utility one", "utility two"] }),
        loreEntries: [loreEntry({ content: "lore content" })],
        persona: { name: "Marv", description: "persona description" },
        path: [message(1, "user", "hello")],
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.systemPrompts).toEqual([
        "user system",
        "utility one",
        "utility two",
        "character system",
        "description",
        "Alice's personality: personality",
        "Scenario: scenario",
        "depth",
        "lore content",
        "Marv's persona: persona description",
        "user post-history",
      ]);
      for (const entry of result.messages) {
        expect(entry.role === "user" || entry.role === "assistant").toBe(true);
        expect("name" in entry).toBe(false);
      }
      expect(result.messages).toEqual([{ role: "user", content: "hello" }]);
    });

    it("uses the character post-history only when the user override is blank", () => {
      const snapshot = makeSnapshot({
        character: { postHistoryInstructions: "CHARACTER POST" },
        settings: { postHistoryInstructions: "USER POST {{char}}" },
      });

      expect(systemText(compilePrompt(snapshot, "chat"))).toContain("USER POST Alice");

      const noOverride = makeSnapshot({
        character: { postHistoryInstructions: "CHARACTER POST {{char}}" },
      });
      const text = systemText(compilePrompt(noOverride, "chat"));
      expect(text).toContain("CHARACTER POST Alice");
      expect(text).not.toContain("USER POST");
    });
  });

  describe("mes_example parsing", () => {
    it("matches speakers case-insensitively against user and character names", () => {
      const snapshot = makeSnapshot({
        character: {
          name: "Alice",
          mesExample: [
            "<START>",
            "{{USER}}: Hello there.",
            "{{Char}}: General Kenobi.",
            "<START>",
            "marv: second block",
            "ALICE: reply in kind",
          ].join("\n"),
        },
        persona: { name: "Marv" },
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.messages).toEqual([
        { role: "user", content: "Hello there." },
        { role: "assistant", content: "General Kenobi." },
        { role: "user", content: "second block" },
        { role: "assistant", content: "reply in kind" },
      ]);
    });

    it("alternates roles for unrecognized speakers and never sets name", () => {
      const snapshot = makeSnapshot({
        character: {
          mesExample: "<START>\nBob: first\nAlice: second\nNarrator: the room falls silent.",
        },
        persona: { name: "Marv" },
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.messages).toEqual([
        { role: "user", content: "Bob: first" },
        { role: "assistant", content: "second" },
        { role: "user", content: "Narrator: the room falls silent." },
      ]);
      for (const entry of result.messages) {
        expect("name" in entry).toBe(false);
      }
    });

    it("ignores empty, root, system, and whitespace-only history messages", () => {
      const snapshot = makeSnapshot({
        path: [
          message(0, "assistant", "root greeting"),
          message(1, "system", "a system note"),
          message(2, "user", "hello"),
          message(3, "assistant", ""),
          message(4, "assistant", "   "),
          message(5, "assistant", "reply"),
        ],
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.messages).toEqual([
        { role: "user", content: "hello" },
        { role: "assistant", content: "reply" },
      ]);
    });
  });

  describe("impersonation", () => {
    it("appends an assistant prefill and character stop strings", () => {
      const snapshot = makeSnapshot({
        character: { name: "Alice" },
        persona: { name: "Marv" },
        settings: { impersonationPrompt: "Speak as {{user}} for one message." },
        path: [message(1, "user", "I greet you.")],
      });

      const result = compilePrompt(snapshot, "impersonate");

      expect(result.messages).toEqual([
        { role: "user", content: "I greet you." },
        { role: "assistant", content: "Marv: " },
      ]);
      expect(result.meta.hasPrefill).toBe(true);
      expect(result.stop).toEqual(["\nAlice:", "\nAlice :"]);
      expect(result.systemPrompts.at(-1)).toBe("Speak as Marv for one message.");
      expect(result.modelOptions).toHaveProperty("max_tokens");
      expect(result.modelOptions).not.toHaveProperty("max_output_tokens");
    });

    it("marks chat prompts as not prefilled", () => {
      const result = compilePrompt(makeSnapshot(), "chat");

      expect(result.meta.hasPrefill).toBe(false);
      expect(result.stop).toBeUndefined();
      expect(result.messages.some((entry) => entry.role === "assistant")).toBe(false);
    });
  });

  describe("image mode", () => {
    it("uses a scene-delta instruction and excludes history", () => {
      const snapshot = makeSnapshot({
        character: { name: "Alice", description: "silver hair, blue eyes" },
        path: [
          message(1, "user", "history-only user line"),
          message(2, "assistant", "history-only assistant line"),
        ],
      });

      const result = compilePrompt(snapshot, "image", {
        imageExample: "masterpiece, 1girl, {{char}}, {{user}}",
      });

      expect(result.messages).toEqual([]);
      expect(systemText(result)).toContain("Scene delta:");
      expect(systemText(result)).toContain("masterpiece, 1girl, Alice, Marv");
      expect(JSON.stringify(result)).not.toContain("history-only");
      expect(result.meta.activatedLore).toBe(0);
      expect(result.meta.hasPrefill).toBe(false);
    });

    it("prefers the options image example over the stored setting", () => {
      const snapshot = makeSnapshot({
        settings: { imagePromptExample: "stored example, {{char}}" },
      });

      const result = compilePrompt(snapshot, "image", { imageExample: "override, {{char}}" });

      expect(systemText(result)).toContain("override, Alice");
      expect(systemText(result)).not.toContain("stored example");
    });
  });

  describe("rewrite and transform", () => {
    it("uses the selection, a compact character context, and no roleplay post-history", () => {
      const snapshot = makeSnapshot({
        character: {
          description: "Alice is a pilot.",
          postHistoryInstructions: "ROLEPLAY POST",
        },
        settings: { postHistoryInstructions: "USER ROLEPLAY POST {{char}}" },
        selection: [message(5, "assistant", "Original paragraph.")],
        path: [message(1, "user", "Different path line.")],
      });

      const rewrite = compilePrompt(snapshot, "rewrite");
      const transform = compilePrompt(snapshot, "transform");

      expect(rewrite.messages).toEqual([{ role: "assistant", content: "Original paragraph." }]);
      expect(systemText(rewrite)).toContain("Alice is a pilot.");
      expect(systemText(rewrite)).toContain("Rewrite the selected text.");
      expect(systemText(rewrite)).not.toContain("ROLEPLAY POST");
      expect(systemText(rewrite)).not.toContain("USER ROLEPLAY POST");

      expect(systemText(transform)).toContain("Transform the selected text");
      expect(transform.messages).toEqual([{ role: "assistant", content: "Original paragraph." }]);
    });

    it("falls back to the active path when no selection is present", () => {
      const snapshot = makeSnapshot({
        path: [message(1, "user", "Path line.")],
      });

      const result = compilePrompt(snapshot, "rewrite");

      expect(result.messages).toEqual([{ role: "user", content: "Path line." }]);
    });
  });

  describe("lore", () => {
    it("counts and includes only enabled, non-empty lore entries", () => {
      const snapshot = makeSnapshot({
        loreEntries: [
          loreEntry({ uid: 1, content: "Lore about {{char}}." }),
          loreEntry({ uid: 2, content: "Disabled lore.", disable: true }),
          loreEntry({ uid: 3, content: "   " }),
        ],
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.meta.activatedLore).toBe(1);
      expect(systemText(result)).toContain("Lore about Alice.");
      expect(systemText(result)).not.toContain("Disabled lore.");
    });
  });

  describe("model options", () => {
    it("uses max_tokens and never max_output_tokens", () => {
      const snapshot = makeSnapshot({
        preset: preset({
          temperature: 0.3,
          topP: 0.7,
          maxResponseLength: 321,
          frequencyPenalty: 0.2,
          presencePenalty: 0.1,
          seed: 42,
        }),
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.modelOptions).toEqual({
        temperature: 0.3,
        top_p: 0.7,
        max_tokens: 321,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
        seed: 42,
      });
      expect(result.modelOptions).not.toHaveProperty("max_output_tokens");
    });

    it("applies defaults and only sends non-negative seeds", () => {
      const defaults = compilePrompt(makeSnapshot(), "chat");
      expect(defaults.modelOptions).toEqual({
        temperature: 0.8,
        top_p: 1,
        max_tokens: 1200,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      const negativeSeed = compilePrompt(makeSnapshot({ preset: preset({ seed: -1 }) }), "chat");
      expect(negativeSeed.modelOptions).not.toHaveProperty("seed");

      const zeroSeed = compilePrompt(makeSnapshot({ preset: preset({ seed: 0 }) }), "chat");
      expect(zeroSeed.modelOptions).toHaveProperty("seed", 0);
    });
  });

  describe("token budget", () => {
    it("drops the oldest history and keeps the last turn", () => {
      const history = Array.from({ length: 10 }, (_, index) =>
        message(index + 1, index % 2 === 0 ? "user" : "assistant", "x".repeat(400)),
      );
      const snapshot = makeSnapshot({
        path: history,
        preset: preset({ contextSize: 1200, maxResponseLength: 100 }),
      });

      const result = compilePrompt(snapshot, "chat");

      expect(result.meta.droppedMessages).toBe(5);
      expect(result.messages).toHaveLength(5);
      expect(result.messages[0]).toEqual({ role: "assistant", content: history[5].content });
      expect(result.messages.at(-1)).toEqual({
        role: "assistant",
        content: history[9].content,
      });
    });

    it("throws ContextOverflowError when mandatory system and last turn exceed the budget", () => {
      const snapshot = makeSnapshot({
        character: { description: "S".repeat(400) },
        path: [message(1, "user", "x".repeat(400))],
        preset: preset({ contextSize: 700, maxResponseLength: 100 }),
      });

      let caught: unknown;
      try {
        compilePrompt(snapshot, "chat");
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ContextOverflowError);
      const overflow = caught as ContextOverflowError;
      expect(overflow._tag).toBe("ContextOverflowError");
      expect(overflow.contextWindow).toBe(700);
      expect(overflow.estimatedTokens).toBeGreaterThan(700 - 100 - 512);
      expect(overflow.message).toContain("reserving 100");
    });
  });

  describe("metadata", () => {
    it("hashes system prompts, messages, and model options with sha256", () => {
      const snapshot = makeSnapshot({
        character: { description: "Alice is a pilot." },
        settings: { systemPrompt: "Be brief." },
        path: [message(1, "user", "hello")],
      });

      const result = compilePrompt(snapshot, "chat");
      const expected = createHash("sha256")
        .update(
          JSON.stringify({
            systemPrompts: result.systemPrompts,
            messages: result.messages,
            modelOptions: result.modelOptions,
          }),
        )
        .digest("hex");

      expect(result.meta.promptHash).toBe(expected);
      expect(result.meta.promptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.meta.mode).toBe("chat");
    });

    it("is deterministic and reports input tokens for the compiled prompt", () => {
      const snapshot = makeSnapshot({
        character: { description: "Alice is a pilot." },
        path: [message(1, "user", "hello")],
      });

      const first = compilePrompt(snapshot, "chat");
      const second = compilePrompt(snapshot, "chat");
      const counter = new ApproxTokenCounter();
      const expectedTokens =
        first.systemPrompts.reduce((total, prompt) => total + counter.count(prompt), 0) +
        first.messages.reduce(
          (total, entry) =>
            total + (typeof entry.content === "string" ? counter.count(entry.content) : 0),
          0,
        );

      expect(second.meta.promptHash).toBe(first.meta.promptHash);
      expect(second.meta.inputTokens).toBe(expectedTokens);
    });
  });
});
