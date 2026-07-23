import { randomUUID } from "node:crypto";
import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import {
  CreateChat,
  DeleteChat,
  DeleteMessageBranch,
  EditMessage,
  GetChat,
  GetChatMessages,
  SendMessage,
  Swipe,
  UpdateChatSettings,
} from "@/server/schemas/chat";
import type { ChatMessageRow, Character } from "@/db/schema";
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
import { getBackground as repoGetBackground } from "@/db/repositories/backgrounds";
import { getPersona as repoGetPersona } from "@/db/repositories/personas";
import { getUserSettings as repoGetUserSettings } from "@/db/repositories/userSettings";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
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

import { rowToMessage, messageToInsert } from "@/lib/chat/rows";

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
  characterDescription: string;
  characterPersonality: string;
  characterScenario: string;
  characterSystemPrompt: string;
  backgroundId: string | null;
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
        localId: getNextId(tree),
        parentLocalId: null,
        children: [],
        selectedChildLocalId: null,
        role: "assistant",
        content: pickDefaultReply(rows.length + 1),
      };
      // 1) Set draft content + clear isDraft flag.
      repoUpdateMessage(user.id, data.chatId, activeLeafId, {
        content: substituteMessageMacros(data.content, macroEnv),
        extra: null,
      });
      // 2) Attach the reply as its child (auto-selects the reply).
      addChild(tree, activeLeafId, reply);
      // 3) Persist the now-mutated draft's children + selectedChildLocalId.
      const updatedDraft = getNode(tree, activeLeafId);
      repoUpdateMessage(user.id, data.chatId, activeLeafId, {
        children: updatedDraft.children,
        selectedChildLocalId: updatedDraft.selectedChildLocalId,
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
      localId: getNextId(tree),
      parentLocalId: null,
      children: [],
      selectedChildLocalId: null,
      role: "user",
      content: substituteMessageMacros(data.content, macroEnv),
    };
    addChild(tree, activeLeafId, userMsg); // auto-selects userMsg on activeLeaf

    const reply: ChatMessage = {
      localId: getNextId(tree),
      parentLocalId: null,
      children: [],
      selectedChildLocalId: null,
      role: "assistant",
      content: pickDefaultReply(rows.length + 1),
    };
    addChild(tree, userMsg.localId, reply); // auto-selects reply on userMsg

    // Persist: update activeLeaf's children+selected, insert userMsg, insert reply.
    const updatedActiveLeaf = getNode(tree, activeLeafId);
    repoUpdateMessage(user.id, data.chatId, activeLeafId, {
      children: updatedActiveLeaf.children,
      selectedChildLocalId: updatedActiveLeaf.selectedChildLocalId,
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
    const parentId = target.parentLocalId;
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
        selectedChildLocalId: parent.selectedChildLocalId,
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
    const isUserMsg = target.role === "user";
    const newMsg: ChatMessage = isUserMsg
      ? {
          localId: getNextId(tree),
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "user",
          // Draft user message — no character name; the user fills it in.
          content: "",
          extra: { isDraft: true },
        }
      : {
          localId: getNextId(tree),
          parentLocalId: null,
          children: [],
          selectedChildLocalId: null,
          role: "assistant",
          content:
            target.parentLocalId === 0
              ? "Make your own greeting!"
              : pickDefaultReply(rows.length + 1),
        };

    addSibling(tree, data.messageLocalId, newMsg);
    selectChild(tree, parentId, newMsg.localId);

    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selectedChildLocalId,
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
    const parentId = target.parentLocalId;
    if (parentId === null) throw new Error("Cannot delete the root message");

    // deleteSubtree mutates the parent: splices the child out, re-points
    // selectedChildLocalId to right-sibling → left-sibling → null.
    deleteSubtree(tree, data.messageLocalId);

    repoDeleteMessages(user.id, data.chatId, subtreeIds);

    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selectedChildLocalId,
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

export const updateChatSettings = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(UpdateChatSettings)(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    const patch: Parameters<typeof repoUpdateChat>[2] = {};
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
