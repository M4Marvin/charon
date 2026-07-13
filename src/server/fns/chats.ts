import { randomUUID } from "node:crypto";
import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import {
  CancelStream,
  CreateChat,
  DeleteChat,
  DeleteMessageBranch,
  EditMessage,
  FinalizeStream,
  GetChat,
  GetChatMessages,
  ImpersonateMessage,
  PrepareStream,
  SendMessage,
  Swipe,
  UpdateChatSettings,
} from "@/server/schemas/chat";
import type { ChatMessageRow, NewChatMessageRow, Character } from "@/db/schema";
import {
  createChat as repoCreateChat,
  deleteChat as repoDeleteChat,
  deleteMessages as repoDeleteMessages,
  getChat as repoGetChat,
  insertMessage as repoInsertMessage,
  listChats as repoListChats,
  listMessages as repoListMessages,
  updateChat as repoUpdateChat,
  updateMessage as repoUpdateMessage,
  type ChatWithCharacter,
} from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import { getAiProviderWithGlobalFallback as repoGetProvider } from "@/db/repositories/aiProviders";
import { getPreset as repoGetPreset } from "@/db/repositories/presets";
import { getPersona as repoGetPersona } from "@/db/repositories/personas";
import { getUserSettings as repoGetUserSettings } from "@/db/repositories/userSettings";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
import type { ChatCompletionPreset } from "@/lib/chat/types";
import { buildChatPrompt } from "@/lib/chat/server-context";
import { DEFAULT_PRESET } from "@/lib/chat/preset";
import { substituteMessageMacros } from "@/lib/chat/substitute-message-macros";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import {
  addChild,
  addSibling,
  deleteSubtree,
  getActiveLeafId,
  getNextId,
  getNode,
  selectChild,
  getNextSiblingId,
  getPrevSiblingId,
} from "@/lib/st-core/chat-tree/tree";

// ── Default replies (rotating, no AI) ───────────────────────────────────────

const DEFAULT_REPLIES = [
  "That's interesting! Tell me more about that.",
  "I see what you mean. What else is on your mind?",
  "Hmm, I need to think about that. Can you elaborate?",
  "Thanks for sharing! I appreciate that.",
  "Interesting perspective! What makes you say that?",
  "I'm not sure I understand. Could you explain differently?",
  "That's a good point. I hadn't considered that before.",
  "You make a lot of sense. What do you think we should do?",
  "I agree with you on that. How are you feeling about things?",
  "Great question! Let me think about it...",
];

function pickDefaultReply(messageCount: number): string {
  return DEFAULT_REPLIES[messageCount % DEFAULT_REPLIES.length] ?? DEFAULT_REPLIES[0]!;
}

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

// ── Mapping helpers (DB row ↔ st-core ChatMessage) ───────────────────────────
// IMPORTANT: st-core ChatMessage uses snake_case (parent_id, selected_child_id,
// is_user, is_system); DB rows use camelCase. Always go through these helpers.

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.localId,
    parent_id: row.parentLocalId,
    children: row.children ?? [],
    selected_child_id: row.selectedChildLocalId,
    role: row.role,
    name: row.name ?? undefined,
    content: row.content,
    is_user: row.isUser ?? undefined,
    is_system: row.isSystem ?? undefined,
    extra: row.extra ?? undefined,
  };
}

function messageToInsert(chatId: string, msg: ChatMessage): NewChatMessageRow {
  return {
    chatId,
    localId: msg.id,
    parentLocalId: msg.parent_id,
    children: msg.children,
    selectedChildLocalId: msg.selected_child_id,
    role: msg.role,
    name: msg.name ?? null,
    content: msg.content,
    isUser: msg.is_user ?? null,
    isSystem: msg.is_system ?? null,
    extra: (msg.extra as Record<string, unknown>) ?? null,
  };
}

function collectSubtreeIds(tree: ChatTree, rootId: number): number[] {
  const ids: number[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = tree.get(id);
    if (!node) continue;
    ids.push(id);
    for (const childId of node.children) stack.push(childId);
  }
  return ids;
}

// ── Exported types ──────────────────────────────────────────────────────────

export type ChatListItem = ChatWithCharacter;

export type ChatDetail = {
  id: string;
  characterId: string;
  characterName: string;
  characterImagePath: string | null;
  title: string;
  characterDescription: string | null;
  characterPersonality: string | null;
  characterScenario: string | null;
  characterSystemPrompt: string | null;
  backgroundPath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SendResult = {
  userMessage: ChatMessageRow;
  assistantMessage: ChatMessageRow;
};

export type SwipeResult = {
  selectedMessage: ChatMessageRow;
};

// ── Server functions ────────────────────────────────────────────────────────

export const listChats = createServerFn({ method: "GET", strict: { output: false } }).handler(
  async (): Promise<ChatListItem[]> => {
    const { user } = await getSession();
    return repoListChats(user.id);
  },
);

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
      characterDescription: chat.characterDescription ?? null,
      characterPersonality: chat.characterPersonality ?? null,
      characterScenario: chat.characterScenario ?? null,
      characterSystemPrompt: chat.characterSystemPrompt ?? null,
      backgroundPath: chat.backgroundPath ?? null,
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
      name: null,
      content: "",
      isUser: null,
      isSystem: true,
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
        name: char.data.name,
        content: substituteMessageMacros(text, macroEnv),
        isUser: false,
        isSystem: false,
        extra: null,
      });
    });

    return {
      id: chat.id,
      characterId: chat.characterId,
      characterName: char.name,
      characterImagePath: char.imagePath,
      title: chat.title,
      characterDescription: chat.characterDescription ?? null,
      characterPersonality: chat.characterPersonality ?? null,
      characterScenario: chat.characterScenario ?? null,
      characterSystemPrompt: chat.characterSystemPrompt ?? null,
      backgroundPath: chat.backgroundPath ?? null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

export const sendMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(SendMessage)(data))
  .handler(async ({ data }): Promise<SendResult> => {
    const { user } = await getSession();

    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) throw new Error("No active message to send from");

    const activeLeaf = getNode(tree, activeLeafId);
    const isDraft = (activeLeaf.extra?.isDraft ?? false) === true;

    const macroEnv = { char: char.data.name, user: resolveUserName(user) };

    if (isDraft) {
      // Draft case: populate the existing draft user message in place.
      // Build the reply first — the draft already exists in the tree, so
      // getNextId(tree) returns a fresh id with no collision.
      const reply: ChatMessage = {
        id: getNextId(tree),
        parent_id: null,
        children: [],
        selected_child_id: null,
        role: "assistant",
        name: char.data.name,
        content: pickDefaultReply(rows.length + 1),
        is_user: false,
        is_system: false,
      };
      // 1) Set draft content + clear isDraft flag.
      repoUpdateMessage(user.id, data.chatId, activeLeafId, {
        content: substituteMessageMacros(data.content, macroEnv),
        extra: null,
      });
      // 2) Attach the reply as its child (auto-selects the reply).
      addChild(tree, activeLeafId, reply);
      // 3) Persist the now-mutated draft's children + selected_child_id.
      const updatedDraft = getNode(tree, activeLeafId);
      repoUpdateMessage(user.id, data.chatId, activeLeafId, {
        children: updatedDraft.children,
        selectedChildLocalId: updatedDraft.selected_child_id,
      });
      // 4) Insert the new reply.
      repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, reply));

      const draftRow = repoListMessages(user.id, data.chatId).find(
        (r) => r.localId === activeLeafId,
      );
      if (!draftRow) throw new Error("Draft message disappeared");

      return {
        userMessage: draftRow,
        assistantMessage: messageToInsert(data.chatId, reply) as ChatMessageRow,
      };
    }

    // Normal case: append user msg as child of active leaf, then reply as child of user msg.
    // IMPORTANT: build + addChild userMsg BEFORE allocating reply's id, otherwise
    // getNextId(tree) returns the same value for both and the second addChild throws.
    const userMsg: ChatMessage = {
      id: getNextId(tree),
      parent_id: null,
      children: [],
      selected_child_id: null,
      role: "user",
      name: user.name,
      content: substituteMessageMacros(data.content, macroEnv),
      is_user: true,
      is_system: false,
    };
    addChild(tree, activeLeafId, userMsg); // auto-selects userMsg on activeLeaf

    const reply: ChatMessage = {
      id: getNextId(tree),
      parent_id: null,
      children: [],
      selected_child_id: null,
      role: "assistant",
      name: char.data.name,
      content: pickDefaultReply(rows.length + 1),
      is_user: false,
      is_system: false,
    };
    addChild(tree, userMsg.id, reply); // auto-selects reply on userMsg

    // Persist: update activeLeaf's children+selected, insert userMsg, insert reply.
    const updatedActiveLeaf = getNode(tree, activeLeafId);
    repoUpdateMessage(user.id, data.chatId, activeLeafId, {
      children: updatedActiveLeaf.children,
      selectedChildLocalId: updatedActiveLeaf.selected_child_id,
    });
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, userMsg));
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, reply));

    return {
      userMessage: messageToInsert(data.chatId, userMsg) as ChatMessageRow,
      assistantMessage: messageToInsert(data.chatId, reply) as ChatMessageRow,
    };
  });

export const swipeMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(Swipe)(data))
  .handler(async ({ data }): Promise<SwipeResult> => {
    if (data.messageLocalId === 0) throw new Error("Cannot swipe the hidden root");
    const { user } = await getSession();

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));

    const target = getNode(tree, data.messageLocalId);
    const parentId = target.parent_id;
    if (parentId === null) throw new Error("Cannot swipe the root message");

    const rowsById = new Map(rows.map((r) => [r.localId, r] as const));
    const findRow = (id: number): ChatMessageRow => {
      const row = rowsById.get(id);
      if (!row) throw new Error(`Message ${id} not found`);
      return row;
    };

    const siblingId =
      data.direction === "next"
        ? getNextSiblingId(tree, data.messageLocalId)
        : getPrevSiblingId(tree, data.messageLocalId);

    if (siblingId !== null) {
      // Existing sibling — just re-point selection on parent.
      selectChild(tree, parentId, siblingId);
      const parent = getNode(tree, parentId);
      repoUpdateMessage(user.id, data.chatId, parentId, {
        children: parent.children,
        selectedChildLocalId: parent.selected_child_id,
      });
      return { selectedMessage: findRow(siblingId) };
    }

    if (data.direction === "prev") {
      // No previous sibling — per spec this is a no-op. The UI disables the
      // left arrow at siblingIndex === 0, so this branch is defensive.
      return { selectedMessage: findRow(data.messageLocalId) };
    }

    // Next direction, no sibling — right arrow is never disabled, so we
    // always create a new sibling. addSibling does NOT auto-select.
    const isUserMsg = (target.is_user ?? target.role === "user") === true;
    const newMsg: ChatMessage = isUserMsg
      ? {
          id: getNextId(tree),
          parent_id: null,
          children: [],
          selected_child_id: null,
          role: "user",
          // Draft user message — no character name; the user fills it in.
          name: undefined,
          content: "",
          is_user: true,
          is_system: false,
          extra: { isDraft: true },
        }
      : {
          id: getNextId(tree),
          parent_id: null,
          children: [],
          selected_child_id: null,
          role: "assistant",
          name: target.name,
          content:
            target.parent_id === 0 ? "Make your own greeting!" : pickDefaultReply(rows.length + 1),
          is_user: false,
          is_system: false,
        };

    addSibling(tree, data.messageLocalId, newMsg);
    selectChild(tree, parentId, newMsg.id);

    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selected_child_id,
    });
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, newMsg));

    return { selectedMessage: messageToInsert(data.chatId, newMsg) as ChatMessageRow };
  });

export const deleteMessageBranch = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(DeleteMessageBranch)(data))
  .handler(async ({ data }): Promise<{ deletedIds: number[] }> => {
    if (data.messageLocalId === 0) throw new Error("Cannot delete the hidden root");
    const { user } = await getSession();

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));

    // Collect IDs of the target + all descendants before mutating the tree.
    const subtreeIds = collectSubtreeIds(tree, data.messageLocalId);
    if (subtreeIds.length === 0) throw new Error("Message not found");

    const target = getNode(tree, data.messageLocalId);
    const parentId = target.parent_id;
    if (parentId === null) throw new Error("Cannot delete the root message");

    // deleteSubtree mutates the parent: splices the child out, re-points
    // selected_child_id to right-sibling → left-sibling → null.
    deleteSubtree(tree, data.messageLocalId);

    repoDeleteMessages(user.id, data.chatId, subtreeIds);

    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selected_child_id,
    });

    return { deletedIds: subtreeIds };
  });

export const editMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(EditMessage)(data))
  .handler(async ({ data }): Promise<{ messageLocalId: number; content: string }> => {
    if (data.messageLocalId === 0) throw new Error("Cannot edit the hidden root");
    const { user } = await getSession();

    // Verify the message exists in this chat (also enforces ownership).
    const existing = repoListMessages(user.id, data.chatId).find(
      (r) => r.localId === data.messageLocalId,
    );
    if (!existing) throw new Error("Message not found");
    // Drafts are populated via send, not edited in place.
    if ((existing.extra?.isDraft ?? false) === true) {
      throw new Error("Cannot edit a draft message; send to populate it instead");
    }

    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);
    const macroEnv = { char: char.data.name, user: resolveUserName(user) };
    const content = substituteMessageMacros(data.content, macroEnv);

    repoUpdateMessage(user.id, data.chatId, data.messageLocalId, { content });
    return { messageLocalId: data.messageLocalId, content };
  });

export const impersonateMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ImpersonateMessage)(data))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { user } = await getSession();
    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);
    const rows = repoListMessages(user.id, data.chatId);

    // Build the active path to the last message
    const tree = treeFromNodes(rows.map(rowToMessage));
    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) throw new Error("No active message");

    const path: ChatMessage[] = [];
    let cur = tree.get(activeLeafId);
    while (cur) {
      path.unshift(cur);
      if (cur.parent_id === null) break;
      cur = tree.get(cur.parent_id);
    }
    const historyMessages = path
      .filter((m) => m.id !== 0)
      .filter((m) => !(m.role === "system" && m.content.length === 0));

    const userSettingsRow = repoGetUserSettings(user.id);
    const providerId = userSettingsRow?.defaultProviderId;
    if (!providerId) throw new Error("No provider configured");
    const provider = await repoGetProvider(user.id, providerId);
    const model = userSettingsRow?.defaultSelectedModel ?? provider.defaultModel;
    if (!model) throw new Error("No model configured");

    let dbPresetRaw: { model?: string | null; data: unknown } | null = null;
    if (userSettingsRow?.defaultPresetId) {
      try {
        dbPresetRaw = repoGetPreset(user.id, userSettingsRow.defaultPresetId);
      } catch {
        /* missing */
      }
    }

    const presetPartial = dbPresetRaw
      ? (() => {
          const d = dbPresetRaw!.data as Record<string, unknown> | null;
          if (!d) return {};
          const p: Partial<ChatCompletionPreset> = {};
          if (d.systemPrompt !== undefined) p.systemPrompt = d.systemPrompt as string;
          if (d.temperature !== undefined) p.temperature = d.temperature as number;
          if (d.maxTokens !== undefined) p.maxResponseLength = d.maxTokens as number;
          if (d.topP !== undefined) p.topP = d.topP as number;
          if (d.contextSize !== undefined) p.contextSize = d.contextSize as number;
          if (d.frequencyPenalty !== undefined) p.frequencyPenalty = d.frequencyPenalty as number;
          if (d.presencePenalty !== undefined) p.presencePenalty = d.presencePenalty as number;
          return p;
        })()
      : {};

    let userPersona: string | undefined;
    if (userSettingsRow?.defaultPersonaId) {
      try {
        const persona = repoGetPersona(user.id, userSettingsRow.defaultPersonaId);
        userPersona = persona.description ?? undefined;
      } catch {
        /* ignore */
      }
    }

    const promptResult = buildChatPrompt({
      character: char.data,
      chatHistory: historyMessages,
      preset: presetPartial,
      defaultPreset: { ...DEFAULT_PRESET },
      userName: user.name,
      userPersona,
      userSystemPrompt: userSettingsRow?.systemPrompt ?? undefined,
      userPostHistoryInstructions: userSettingsRow?.postHistoryInstructions ?? undefined,
    });

    const impersonationInstruction = (
      userSettingsRow?.impersonationPrompt ??
      "Continue the conversation from {{user}}'s perspective, writing the next message as {{user}} would."
    ).replace(/\{\{user\}\}/gi, user.name);

    const finalMessages = [
      { role: "system" as const, content: impersonationInstruction },
      ...promptResult.messages,
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
    if (provider.defaultHeaders) {
      for (const [k, v] of Object.entries(provider.defaultHeaders)) {
        if (v) headers[k] = v;
      }
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: finalMessages,
        stream: false,
        ...promptResult.modelOptions,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider returned ${response.status}: ${body}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string | null } }>;
    };
    const text = json.choices[0]?.message?.content ?? "";
    return { text };
  });

export type StreamResult = {
  assistantMessageLocalId: number;
};

export const prepareStreamMessage = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator((data) => Schema.decodeUnknownSync(PrepareStream)(data))
  .handler(async ({ data }): Promise<StreamResult> => {
    // The schema keeps `content` and `messageLocalId` optional; the handler
    // treats them as mode-specific and normalizes up-front.
    const content = data.content ?? "";
    const messageLocalId = data.messageLocalId ?? 0;
    if (messageLocalId === 0 && data.mode === "regenerate")
      throw new Error("Cannot regenerate the hidden root");
    const { user } = await getSession();

    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);
    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const macroEnv = { char: char.data.name, user: resolveUserName(user) };

    console.log("[prepareStream] start", {
      mode: data.mode,
      messageLocalId,
      contentLen: content.length,
      treeSize: tree.size,
    });

    let assistantMessageLocalId: number;

    if (data.mode === "send") {
      // Add user message as child of active leaf, then assistant placeholder
      const activeLeafId = getActiveLeafId(tree);
      if (activeLeafId === null) throw new Error("No active message to send from");
      const activeLeaf = getNode(tree, activeLeafId);
      const isDraft = (activeLeaf.extra?.isDraft ?? false) === true;

      if (isDraft) {
        // Populate draft, add placeholder as child
        repoUpdateMessage(user.id, data.chatId, activeLeafId, {
          content: substituteMessageMacros(content, macroEnv),
          extra: null,
        });
        const placeholder: ChatMessage = {
          id: getNextId(tree),
          parent_id: null,
          children: [],
          selected_child_id: null,
          role: "assistant",
          name: char.data.name,
          content: "",
          is_user: false,
          is_system: false,
          extra: { isStreaming: true },
        };
        addChild(tree, activeLeafId, placeholder);
        const updatedDraft = getNode(tree, activeLeafId);
        repoUpdateMessage(user.id, data.chatId, activeLeafId, {
          children: updatedDraft.children,
          selectedChildLocalId: updatedDraft.selected_child_id,
        });
        repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, placeholder));
        assistantMessageLocalId = placeholder.id;
      } else {
        // Normal case: user msg + assistant placeholder
        const userMsg: ChatMessage = {
          id: getNextId(tree),
          parent_id: null,
          children: [],
          selected_child_id: null,
          role: "user",
          name: user.name,
          content: substituteMessageMacros(content, macroEnv),
          is_user: true,
          is_system: false,
        };
        addChild(tree, activeLeafId, userMsg);
        const placeholder: ChatMessage = {
          id: getNextId(tree),
          parent_id: null,
          children: [],
          selected_child_id: null,
          role: "assistant",
          name: char.data.name,
          content: "",
          is_user: false,
          is_system: false,
          extra: { isStreaming: true },
        };
        addChild(tree, userMsg.id, placeholder);

        const updatedActiveLeaf = getNode(tree, activeLeafId);
        repoUpdateMessage(user.id, data.chatId, activeLeafId, {
          children: updatedActiveLeaf.children,
          selectedChildLocalId: updatedActiveLeaf.selected_child_id,
        });
        repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, userMsg));
        repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, placeholder));
        assistantMessageLocalId = placeholder.id;
      }
    } else if (data.mode === "continue") {
      // Empty-send continue: generate a response from the active leaf.
      // If the active leaf is a user message → add assistant placeholder
      // as its child. If it's an assistant message → add a sibling
      // (regenerate). This lets the user press Send with empty input to
      // get a new response after deleting the previous assistant reply.
      const activeLeafId = getActiveLeafId(tree);
      if (activeLeafId === null) throw new Error("No active message to continue from");
      const activeLeaf = getNode(tree, activeLeafId);

      if ((activeLeaf.extra?.isDraft ?? false) === true)
        throw new Error("Cannot continue from a draft message");

      const placeholder: ChatMessage = {
        id: getNextId(tree),
        parent_id: null,
        children: [],
        selected_child_id: null,
        role: "assistant",
        name: char.data.name,
        content: "",
        is_user: false,
        is_system: false,
        extra: { isStreaming: true },
      };

      if (activeLeaf.role === "user" || activeLeaf.is_user) {
        // Active leaf is a user message awaiting a reply.
        addChild(tree, activeLeafId, placeholder);
        const updatedLeaf = getNode(tree, activeLeafId);
        repoUpdateMessage(user.id, data.chatId, activeLeafId, {
          children: updatedLeaf.children,
          selectedChildLocalId: updatedLeaf.selected_child_id,
        });
      } else {
        // Active leaf is an assistant message — add sibling (regenerate).
        if (activeLeaf.parent_id === null)
          throw new Error("Cannot continue from a root-level assistant");
        addSibling(tree, activeLeafId, placeholder);
        selectChild(tree, activeLeaf.parent_id, placeholder.id);
        const parent = getNode(tree, activeLeaf.parent_id);
        repoUpdateMessage(user.id, data.chatId, activeLeaf.parent_id, {
          children: parent.children,
          selectedChildLocalId: parent.selected_child_id,
        });
      }

      repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, placeholder));
      assistantMessageLocalId = placeholder.id;
    } else {
      // Regenerate mode: create sibling of target assistant message
      const target = getNode(tree, messageLocalId);
      if (target.role !== "assistant") throw new Error("Can only regenerate assistant messages");
      if (target.is_system) throw new Error("Cannot regenerate system messages");
      if (target.parent_id === null) throw new Error("Cannot regenerate root message");
      if ((target.extra?.isStreaming ?? false) === true)
        throw new Error("Cannot regenerate a message that is still streaming");

      console.log("[prepareStream] regenerate target", {
        targetRole: target.role,
        targetParentId: target.parent_id,
        targetExtraStreaming: (target.extra?.isStreaming ?? false) === true,
      });

      const placeholder: ChatMessage = {
        id: getNextId(tree),
        parent_id: null,
        children: [],
        selected_child_id: null,
        role: "assistant",
        name: char.data.name,
        content: "",
        is_user: false,
        is_system: false,
        extra: { isStreaming: true },
      };
      addSibling(tree, messageLocalId, placeholder);
      selectChild(tree, target.parent_id, placeholder.id);

      const parent = getNode(tree, target.parent_id);
      repoUpdateMessage(user.id, data.chatId, target.parent_id, {
        children: parent.children,
        selectedChildLocalId: parent.selected_child_id,
      });
      repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, placeholder));
      assistantMessageLocalId = placeholder.id;
    }

    console.log("[prepareStream] done", { assistantMessageLocalId });
    return { assistantMessageLocalId };
  });

export const finalizeStream = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(FinalizeStream)(data))
  .handler(async ({ data }): Promise<{ messageLocalId: number; content: string }> => {
    if (data.messageLocalId === 0) throw new Error("Cannot finalize the hidden root");
    const { user } = await getSession();
    const rows = repoListMessages(user.id, data.chatId);
    const existing = rows.find((r) => r.localId === data.messageLocalId);
    if (!existing) throw new Error("Message not found");
    if ((existing.extra?.isStreaming ?? false) !== true) {
      throw new Error("Message is not a streaming placeholder");
    }

    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);
    const macroEnv = { char: char.data.name, user: resolveUserName(user) };
    const content = substituteMessageMacros(data.content, macroEnv);

    repoUpdateMessage(user.id, data.chatId, data.messageLocalId, {
      content,
      extra: null,
    });
    return { messageLocalId: data.messageLocalId, content };
  });

export const cancelStream = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(CancelStream)(data))
  .handler(async ({ data }): Promise<{ deletedIds: number[] }> => {
    if (data.messageLocalId === 0) throw new Error("Cannot cancel the hidden root");
    const { user } = await getSession();
    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const subtreeIds = collectSubtreeIds(tree, data.messageLocalId);
    if (subtreeIds.length === 0) throw new Error("Message not found");
    const target = getNode(tree, data.messageLocalId);
    const parentId = target.parent_id;
    if (parentId === null) throw new Error("Cannot cancel root message");
    deleteSubtree(tree, data.messageLocalId);
    repoDeleteMessages(user.id, data.chatId, subtreeIds);
    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selected_child_id,
    });
    return { deletedIds: subtreeIds };
  });

export const updateChatSettings = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(UpdateChatSettings)(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: Parameters<typeof repoUpdateChat>[2] = {};
    if (data.characterDescription !== undefined) patch.characterDescription = data.characterDescription;
    if (data.characterPersonality !== undefined) patch.characterPersonality = data.characterPersonality;
    if (data.characterScenario !== undefined) patch.characterScenario = data.characterScenario;
    if (data.characterSystemPrompt !== undefined) patch.characterSystemPrompt = data.characterSystemPrompt;
    if (data.backgroundPath !== undefined) patch.backgroundPath = data.backgroundPath;
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
