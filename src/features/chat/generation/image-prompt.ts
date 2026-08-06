import { db as defaultDb, type DB } from "@/db";
import { loadChatConfig } from "../config/service";
import { getMessages } from "../tree/service";
import { getPathToNode } from "../tree/active-path";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId } from "@/lib/st-core/chat-tree/tree";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:gen:image-prompt");

export const DEFAULT_IMAGE_PROMPT_EXAMPLE =
  "masterpiece, best quality, 1girl, silver hair, long hair, blue eyes, school uniform, standing in a sunlit classroom, cherry blossoms outside the window, looking at viewer, soft lighting, detailed background";

const SCENE_MESSAGE_LIMIT = 10;

export interface ImagePromptOptions {
  fetchFn?: typeof globalThis.fetch;
}

export async function generateImagePrompt(
  userId: string,
  chatId: string,
  userName: string,
  options?: ImagePromptOptions,
  db: DB = defaultDb,
): Promise<{ text: string }> {
  log.debug("generateImagePrompt start", { chatId });
  const fetchFn = options?.fetchFn ?? globalThis.fetch;

  const messages = getMessages(userId, chatId, db);
  const tree = treeFromNodes(messages);
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new Error("No active message");

  const config = await loadChatConfig(userId, chatId, userName, db);
  if (!config.provider) throw new Error("No provider configured");

  const { chat, character, settings, provider } = config;

  const path = getPathToNode(tree, activeLeafId);
  const chatHistory = path.filter((m) => {
    if (m.localId === 0) return false;
    if (m.role === "system" && m.content.length === 0) return false;
    return true;
  });

  const sceneMessages = chatHistory
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.length > 0)
    .slice(-SCENE_MESSAGE_LIMIT);

  const scene =
    sceneMessages.length > 0
      ? sceneMessages
          .map((m) => `${m.role === "user" ? userName : character.name}: ${m.content}`)
          .join("\n")
      : character.scenario;

  const example = settings.imagePromptExample ?? DEFAULT_IMAGE_PROMPT_EXAMPLE;
  const instruction = [
    "You write image prompts for anime image generation models in danbooru tag style.",
    "Output ONLY a comma-separated tag list: quality tokens first, then character tags (appearance, clothing), then scenario tags (setting, pose, action), then style tags. No prose, no sentences, no explanations.",
    "The character base MUST stay identical, only the scenario varies.",
    "Match the format of this example:",
    example,
  ].join("\n");

  const characterContext = [
    chat.characterDescription || character.description
      ? `${character.name}: ${chat.characterDescription || character.description}`
      : null,
    chat.characterPersonality || character.personality
      ? `Personality: ${chat.characterPersonality || character.personality}`
      : null,
    character.tags.length > 0 ? `Tags: ${character.tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const finalMessages: Array<{ role: "system" | "user"; content: string }> = [];

  finalMessages.push({ role: "system", content: instruction });

  if (characterContext) {
    finalMessages.push({ role: "system", content: characterContext });
  }

  finalMessages.push({ role: "user", content: `Current scene: ${scene}` });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.provider.apiKey}`,
  };
  if (provider.provider.defaultHeaders) {
    for (const [k, v] of Object.entries(provider.provider.defaultHeaders)) {
      if (v) headers[k] = v;
    }
  }

  const response = await fetchFn(`${provider.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: finalMessages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    log.error("generateImagePrompt: provider error", {
      status: response.status,
      body: body.substring(0, 500),
    });
    throw new Error(`Provider returned ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };
  const text = json.choices[0]?.message?.content ?? "";
  log.info("generateImagePrompt done", { textLen: text.length });
  return { text };
}
