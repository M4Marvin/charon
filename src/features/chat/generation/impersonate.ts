import { db as defaultDb, type DB } from "@/db";
import { loadGenerationContext } from "./prompt-context";
import { getMessages } from "../tree/service";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId } from "@/lib/st-core/chat-tree/tree";
import { getUserSettings } from "@/db/repositories/userSettings";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:impersonate");

const DEFAULT_IMPERSONATION_PROMPT =
  "Write {{user}}'s next message in the roleplay. Match the narrative voice and prose style of the conversation so far. Stay in character — only narrate {{user}}'s actions and dialogue, not those of {{char}} or other characters. No OOC commentary.";

export interface ImpersonateOptions {
  fetchFn?: typeof globalThis.fetch;
}

export async function impersonateMessage(
  userId: string,
  chatId: string,
  userName: string,
  options?: ImpersonateOptions,
  db: DB = defaultDb,
): Promise<{ text: string }> {
  log.debug("impersonateMessage start", { chatId });
  const fetchFn = options?.fetchFn ?? globalThis.fetch;

  const messages = getMessages(userId, chatId, db);
  const hasUserMessage = messages.some((m) => m.role === "user" && m.localId !== 0);
  if (!hasUserMessage) {
    throw new Error("Cannot impersonate: at least one user message is required in the conversation");
  }

  const tree = treeFromNodes(messages);
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new Error("No active message");

  const ctx = await loadGenerationContext(userId, userName, chatId, activeLeafId, db);

  const settings = getUserSettings(userId, db);
  const rawInstruction = settings?.impersonationPrompt ?? DEFAULT_IMPERSONATION_PROMPT;
  const instruction = rawInstruction
    .replace(/\{\{user\}\}/gi, ctx.prompt.userName)
    .replace(/\{\{char\}\}/gi, ctx.prompt.character.name);

  const characterContext = [
    ctx.prompt.characterDescription || ctx.prompt.character.description
      ? `${ctx.prompt.character.name}: ${ctx.prompt.characterDescription || ctx.prompt.character.description}`
      : null,
    ctx.prompt.characterPersonality || ctx.prompt.character.personality
      ? `Personality: ${ctx.prompt.characterPersonality || ctx.prompt.character.personality}`
      : null,
    ctx.prompt.characterScenario || ctx.prompt.character.scenario
      ? `Scenario: ${ctx.prompt.characterScenario || ctx.prompt.character.scenario}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const finalMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  finalMessages.push({ role: "system", content: instruction });

  if (characterContext) {
    finalMessages.push({ role: "system", content: characterContext });
  }

  if (ctx.prompt.userPersona) {
    finalMessages.push({
      role: "system",
      content: `${ctx.prompt.userName}'s persona: ${ctx.prompt.userPersona}`,
    });
  }

  for (const m of ctx.prompt.chatHistory) {
    if (m.role === "user" || m.role === "assistant") {
      finalMessages.push({ role: m.role, content: m.content });
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ctx.resolved.provider.apiKey}`,
  };
  if (ctx.resolved.provider.defaultHeaders) {
    for (const [k, v] of Object.entries(ctx.resolved.provider.defaultHeaders)) {
      if (v) headers[k] = v;
    }
  }

  const response = await fetchFn(
    `${ctx.resolved.provider.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: ctx.resolved.model,
        messages: finalMessages,
        stream: false,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    log.error("impersonateMessage: provider error", { status: response.status, body: body.substring(0, 500) });
    throw new Error(`Provider returned ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };
  const text = json.choices[0]?.message?.content ?? "";
  log.info("impersonateMessage done", { textLen: text.length });
  return { text };
}
