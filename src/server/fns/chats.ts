import { randomUUID } from "node:crypto";
import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import {
  CreateChat,
  DeleteChat,
  GetChat,
  GetChatMessages,
  UpdateChatSettings,
} from "@/server/schemas/chat";
import type { ChatMessageRow, Character } from "@/db/schema";
import {
  createChat as repoCreateChat,
  deleteChat as repoDeleteChat,
  getChat as repoGetChat,
  insertMessage as repoInsertMessage,
  listChats as repoListChats,
  listChatsByCharacter as repoListChatsByCharacter,
  listMessages as repoListMessages,
  updateChat as repoUpdateChat,
  type ChatWithCharacter,
} from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import { getBackground as repoGetBackground } from "@/db/repositories/backgrounds";
import { getPersona as repoGetPersona } from "@/db/repositories/personas";
import { getUserSettings as repoGetUserSettings } from "@/db/repositories/userSettings";
import { substituteMessageMacros } from "@/lib/chat/substitute-message-macros";

function resolveUserName(user: { id: string; name: string }): string {
  try {
    const settings = repoGetUserSettings(user.id);
    if (settings?.defaultPersonaId) {
      try {
        return repoGetPersona(user.id, settings.defaultPersonaId).name;
      } catch {
        // Persona deleted — fall through to user.name
      }
    }
  } catch {
    // Settings not found — fall through to user.name
  }
  return user.name;
}

// ── Exported types ──────────────────────────────────────────────────────────

export type ChatListItem = ChatWithCharacter;

export type ChatDetail = {
  id: string;
  characterId: string;
  characterName: string;
  characterImagePath: string | null;
  title: string;
  characterDescription: string;
  characterPersonality: string;
  characterScenario: string;
  characterSystemPrompt: string;
  backgroundId: string | null;
  backgroundPath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Server functions ────────────────────────────────────────────────────────

export const listChats = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async (): Promise<ChatListItem[]> => {
    const { user } = await getSession();
    return repoListChats(user.id);
  },
);

export const listChatsByCharacter = createServerFn({
  method: "GET",
  strict: { output: false },
})
  .validator((data) => Schema.decodeUnknownSync(GetChat)(data))
  .handler(async ({ data }): Promise<ChatListItem[]> => {
    const { user } = await getSession();
    return repoListChatsByCharacter(user.id, data.id);
  });

export const getChat = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(GetChat)(data))
  .handler(async ({ data }): Promise<ChatDetail> => {
    const { user } = await getSession();
    const chat = repoGetChat(user.id, data.id);
    const char = repoGetChar(user.id, chat.characterId);
    return {
      id: chat.id,
      characterId: chat.characterId,
      characterName: char.name,
      characterImagePath: char.imagePath,
      title: chat.title,
      characterDescription: chat.characterDescription,
      characterPersonality: chat.characterPersonality,
      characterScenario: chat.characterScenario,
      characterSystemPrompt: chat.characterSystemPrompt,
      backgroundId: chat.backgroundId ?? null,
      backgroundPath: chat.backgroundId
        ? (repoGetBackground(chat.backgroundId).path ?? null)
        : null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

export const getChatMessages = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(GetChatMessages)(data))
  .handler(async ({ data }): Promise<ChatMessageRow[]> => {
    const { user } = await getSession();
    return repoListMessages(user.id, data.id);
  });

export const createChat = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(CreateChat)(data))
  .handler(async ({ data }): Promise<ChatDetail> => {
    const { user } = await getSession();
    const char: Character = repoGetChar(user.id, data.characterId);

    const chatId = randomUUID();
    const chat = repoCreateChat({
      id: chatId,
      userId: user.id,
      characterId: data.characterId,
      title: char.data.name,
      characterDescription: char.data.description,
      characterPersonality: char.data.personality,
      characterScenario: char.data.scenario,
      characterSystemPrompt: char.data.system_prompt,
    });

    // Collect all greetings: first_mes + every alternate_greeting.
    // Use != null so an empty-string first_mes is still included (some cards
    // have a present-but-empty first_mes and rely on alternates as the actual
    // opening message).
    const greetingTexts: string[] = [];
    if (char.data.first_mes != null) greetingTexts.push(char.data.first_mes);
    if (char.data.alternate_greetings) greetingTexts.push(...char.data.alternate_greetings);
    if (greetingTexts.length === 0) greetingTexts.push("Hello!");

    // Insert hidden system root (localId=0). It is never rendered, swiped,
    // edited, or deleted — all other server fns reject messageLocalId === 0.
    repoInsertMessage(user.id, chatId, {
      chatId,
      localId: 0,
      parentLocalId: null,
      children: greetingTexts.map((_, i) => i + 1),
      selectedChildLocalId: 1, // first_mes is the default greeting
      role: "system",
      content: "",
      extra: null,
    });

    // Insert every greeting as a child of the hidden root.
    const macroEnv = { char: char.data.name, user: resolveUserName(user) };
    greetingTexts.forEach((text, i) => {
      const localId = i + 1;
      repoInsertMessage(user.id, chatId, {
        chatId,
        localId,
        parentLocalId: 0,
        children: [],
        selectedChildLocalId: null,
        role: "assistant",
        content: substituteMessageMacros(text, macroEnv),
        extra: null,
      });
    });

    return {
      id: chat.id,
      characterId: chat.characterId,
      characterName: char.name,
      characterImagePath: char.imagePath,
      title: chat.title,
      characterDescription: chat.characterDescription,
      characterPersonality: chat.characterPersonality,
      characterScenario: chat.characterScenario,
      characterSystemPrompt: chat.characterSystemPrompt,
      backgroundId: chat.backgroundId ?? null,
      backgroundPath: chat.backgroundId
        ? (repoGetBackground(chat.backgroundId).path ?? null)
        : null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

export const updateChatSettings = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(UpdateChatSettings)(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: Parameters<typeof repoUpdateChat>[2] = {};
    if (data.title !== undefined) patch.title = data.title ?? "";
    if (data.characterDescription !== undefined)
      patch.characterDescription = data.characterDescription ?? "";
    if (data.characterPersonality !== undefined)
      patch.characterPersonality = data.characterPersonality ?? "";
    if (data.characterScenario !== undefined)
      patch.characterScenario = data.characterScenario ?? "";
    if (data.characterSystemPrompt !== undefined)
      patch.characterSystemPrompt = data.characterSystemPrompt ?? "";
    if (data.backgroundId !== undefined) patch.backgroundId = data.backgroundId;
    repoUpdateChat(user.id, data.id, patch);
    return { id: data.id };
  });

export const deleteChat = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(DeleteChat)(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDeleteChat(user.id, data.id);
    return { id: data.id };
  });
