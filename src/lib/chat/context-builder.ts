import { renderStoryString } from "@/lib/st-core/context/story-string.js";
import { LorePosition } from "@/lib/st-core/lorebook/types.js";
import type { StoryStringParams } from "@/lib/st-core/context/types.js";
import type { ChatMessage } from "@/lib/st-core/shared/types.js";
import type { LoreGlobalData } from "@/lib/st-core/lorebook/types.js";
import { convertBookEntries, scanLoreEntries, toLoreEntryView } from "./lorebook.js";
import { toModelMessages } from "./pre-process.js";
import type {
  ModelMessage,
  PipelineCharacter,
  ChatCompletionPreset,
  LoreScanView,
} from "./types.js";

export function buildMessages(
  character: PipelineCharacter,
  chatHistory: ChatMessage[],
  preset: ChatCompletionPreset,
  userName: string,
  userPersona?: string,
  extraLoreEntries: import("@/lib/st-core/lorebook/types").LoreEntry[] = [],
  userSystemPrompt?: string,
  userPostHistoryInstructions?: string,
): { messages: ModelMessage[]; loreScan: LoreScanView } {
  const storyParams: StoryStringParams = {
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    system: character.system_prompt,
    char: character.name,
    user: userName,
    mesExamples: character.mes_example,
  };
  const charDescription = renderStoryString(
    "{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}'s personality: {{personality}}\n{{/if}}",
    storyParams,
  );

  const scenario = renderStoryString(
    "{{#if scenario}}Scenario: {{scenario}}\n{{/if}}",
    storyParams,
  );

  const exampleBlocks: string[] = character.mes_example
    .split(/<START>/gi)
    .map((b) => b.trim())
    .filter(Boolean);

  function parseExampleBlock(block: string, charName: string, userName: string): ModelMessage[] {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const out: ModelMessage[] = [];
    let expectAssistant = true;
    for (const line of lines) {
      const colon = line.indexOf(": ");
      if (colon === -1) {
        out.push({ role: expectAssistant ? "assistant" : "user", content: line });
        continue;
      }
      const speaker = line.slice(0, colon);
      const content = line.slice(colon + 2);
      let role: "assistant" | "user";
      if (speaker === charName) role = "assistant";
      else if (speaker === userName) role = "user";
      else role = expectAssistant ? "assistant" : "user";
      out.push({ role, content, name: role === "assistant" ? charName : userName });
      expectAssistant = role !== "assistant";
    }
    return out;
  }

  // Collect lore entries: first from embedded character_book, then
  // caller-supplied extras (e.g. standalone lorebooks the user has
  // enabled, with per-user entry disables already applied by the caller).
  // Pre-filter `disable: true` on both sources so it takes effect in the
  // initial scan (the scan only checks `disable` during recursion).
  const loreEntries: import("@/lib/st-core/lorebook/types").LoreEntry[] = [];
  if (character.character_book?.entries) {
    loreEntries.push(
      ...convertBookEntries(character.character_book.entries).filter((e) => !e.disable),
    );
  }
  if (extraLoreEntries.length > 0) {
    loreEntries.push(...extraLoreEntries.filter((e) => !e.disable));
  }

  const globalData: LoreGlobalData = {
    personaDescription: userPersona ?? "",
    characterDescription: character.description,
    characterPersonality: character.personality,
    characterDepthPrompt: character.depth_prompt?.prompt ?? "",
    scenario: character.scenario,
    creatorNotes: character.creator_notes,
    trigger: "",
  };
  const { activated, inactive } = scanLoreEntries(loreEntries, chatHistory, globalData);
  const loreScan: LoreScanView = {
    activated: activated.map(toLoreEntryView),
    inactive: inactive.map(toLoreEntryView),
  };

  const beforeEntries = activated.filter((e) => e.position === LorePosition.Before);
  const afterEntries = activated.filter((e) => e.position === LorePosition.After);
  const atDepthEntries = activated.filter((e) => e.position === LorePosition.AtDepth);

  let historyMessages: ModelMessage[] = toModelMessages(chatHistory, character.name, userName);

  if (character.depth_prompt) {
    const insertIdx = Math.max(0, historyMessages.length - character.depth_prompt.depth);
    historyMessages = [
      ...historyMessages.slice(0, insertIdx),
      { role: character.depth_prompt.role, content: character.depth_prompt.prompt },
      ...historyMessages.slice(insertIdx),
    ];
  }

  for (const entry of atDepthEntries) {
    const insertIdx = Math.max(0, historyMessages.length - entry.depth);
    historyMessages = [
      ...historyMessages.slice(0, insertIdx),
      { role: "system", content: entry.content },
      ...historyMessages.slice(insertIdx),
    ];
  }

  const messages: ModelMessage[] = [];

  // User-level system prompt takes precedence as the first system message.
  if (userSystemPrompt) messages.push({ role: "system", content: userSystemPrompt });

  const mainPrompt = preset.utilityPrompts.join("\n\n");
  if (mainPrompt) messages.push({ role: "system", content: mainPrompt });

  for (const entry of beforeEntries) {
    messages.push({ role: "system", content: entry.content });
  }

  if (userPersona) {
    messages.push({ role: "system", content: userPersona });
  }

  if (charDescription) {
    messages.push({ role: "system", content: charDescription });
  }

  if (scenario) {
    messages.push({ role: "system", content: scenario });
  }

  for (const entry of afterEntries) {
    messages.push({ role: "system", content: entry.content });
  }

  for (const block of exampleBlocks) {
    messages.push({ role: "system", content: "[Example Chat]" });
    const exampleMessages = parseExampleBlock(block, character.name, userName);
    for (const msg of exampleMessages) {
      messages.push(msg);
    }
  }

  messages.push({ role: "system", content: "[Start a new Chat]" });

  messages.push(...historyMessages);

  // User-level post-history instructions override the character's.
  if (userPostHistoryInstructions) {
    messages.push({ role: "system", content: userPostHistoryInstructions });
  } else if (character.post_history_instructions) {
    messages.push({ role: "system", content: character.post_history_instructions });
  }

  return { messages, loreScan };
}
