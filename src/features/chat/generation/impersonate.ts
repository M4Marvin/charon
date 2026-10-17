import { db as defaultDb, type DB } from "@/db";
import { loadChatConfig } from "../config/service";
import { getMessages } from "../tree/service";
import { getPathToNode } from "../tree/active-path";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId } from "@/lib/st-core/chat-tree/tree";
import { completeChat } from "./complete";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:impersonate");

const DEFAULT_IMPERSONATION_PROMPT =
  "Write {{user}}'s next message in the roleplay. Match the narrative voice and prose style of the conversation so far. Stay in character — only narrate {{user}}'s actions and dialogue, not those of {{char}} or other characters. No OOC commentary.";

export interface ImpersonateOptions {
  fetchFn?: typeof globalThis.fetch;
}

export async function impersonateMessage(
  userId: string, // account FK
  chatId: string,
  userName: string,
  options?: ImpersonateOptions,
  db: DB = defaultDb,
): Promise<{ text: string }> {
  log.debug("impersonateMessage start", { chatId });
  const fetchFn = options?.fetchFn ?? globalThis.fetch;

  const messages = getMessages(chatId, db);
  const hasUserMessage = messages.some((m) => m.role === "user" && m.localId !== 0);
  if (!hasUserMessage) {
    throw new Error(
      "Cannot impersonate: at least one user message is required in the conversation",
    );
  }

  const tree = treeFromNodes(messages);
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new Error("No active message");

  const config = await loadChatConfig(userId, chatId, userName, db); // account FK
  if (!config.provider) throw new Error("No provider configured");

  const { chat, character, settings, provider, persona } = config;

  const path = getPathToNode(tree, activeLeafId);
  const chatHistory = path.filter((m) => {
    if (m.localId === 0) return false;
    if (m.role === "system" && m.content.length === 0) return false;
    return true;
  });

  const rawInstruction = settings.impersonationPrompt ?? DEFAULT_IMPERSONATION_PROMPT;
  const instruction = rawInstruction
    .replace(/\{\{user\}\}/gi, persona.name)
    .replace(/\{\{char\}\}/gi, character.name);

  const characterContext = [
    chat.characterDescription || character.description
      ? `${character.name}: ${chat.characterDescription || character.description}`
      : null,
    chat.characterPersonality || character.personality
      ? `Personality: ${chat.characterPersonality || character.personality}`
      : null,
    chat.characterScenario || character.scenario
      ? `Scenario: ${chat.characterScenario || character.scenario}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const finalMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  finalMessages.push({ role: "system", content: instruction });

  if (characterContext) {
    finalMessages.push({ role: "system", content: characterContext });
  }

  if (persona.description) {
    finalMessages.push({
      role: "system",
      content: `${persona.name}'s persona: ${persona.description}`,
    });
  }

  for (const m of chatHistory) {
    if (m.role === "user" || m.role === "assistant") {
      finalMessages.push({ role: m.role, content: m.content });
    }
  }

  const text = await completeChat(provider, finalMessages, fetchFn);
  log.info("impersonateMessage done", { textLen: text.length });
  return { text };
}
