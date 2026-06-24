import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import type { ChatMessageRow, NewChatMessageRow, Character } from "@/db/schema";
import {
  createChat as repoCreateChat,
  deleteChat as repoDeleteChat,
  getChat as repoGetChat,
  insertMessage as repoInsertMessage,
  listChats as repoListChats,
  listMessages as repoListMessages,
  updateMessage as repoUpdateMessage,
  type ChatWithCharacter,
} from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import type { ChatMessage } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import {
  addChild,
  addSibling,
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

// ── Mapping helpers ─────────────────────────────────────────────────────────

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

// ── Exported types ──────────────────────────────────────────────────────────

export type ChatListItem = ChatWithCharacter;

export type ChatDetail = {
  id: string;
  characterId: string;
  characterName: string;
  characterImagePath: string | null;
  title: string;
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
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("id is required");
    return { id: d.id };
  })
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
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

export const getChatMessages = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("id is required");
    return { id: d.id };
  })
  .handler(async ({ data }): Promise<ChatMessageRow[]> => {
    const { user } = await getSession();
    return repoListMessages(user.id, data.id);
  });

export const createChat = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.characterId !== "string") throw new Error("characterId is required");
    return { characterId: d.characterId, greetingIndex: (d.greetingIndex ?? 0) as number };
  })
  .handler(async ({ data }): Promise<ChatDetail> => {
    const { user } = await getSession();
    const char: Character = repoGetChar(user.id, data.characterId);

    // Pick greeting text
    const greetings = char.data.alternate_greetings ?? [];
    const greetingText =
      greetings[data.greetingIndex] ?? char.data.first_mes ?? "Hello!";

    const chatId = randomUUID();
    const chat = repoCreateChat({
      id: chatId,
      userId: user.id,
      characterId: data.characterId,
      title: char.data.name,
    });

    // Create root greeting message
    repoInsertMessage(user.id, chatId, {
      chatId,
      localId: 1,
      parentLocalId: null,
      children: [],
      selectedChildLocalId: null,
      role: "assistant",
      name: char.data.name,
      content: greetingText,
      isUser: false,
      isSystem: false,
      extra: null,
    });

    return {
      id: chat.id,
      characterId: chat.characterId,
      characterName: char.data.name,
      characterImagePath: char.imagePath,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

export const sendMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    if (typeof d.content !== "string") throw new Error("content is required");
    return { chatId: d.chatId, content: d.content };
  })
  .handler(async ({ data }): Promise<SendResult> => {
    const { user } = await getSession();

    // Load character for name + reply count
    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);

    // Load messages and build tree
    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));

    // Add user message at active leaf
    const activeLeafId = getActiveLeafId(tree);
    const userMsg: ChatMessage = {
      id: getNextId(tree),
      parent_id: null,
      children: [],
      selected_child_id: null,
      role: "user",
      name: user.name,
      content: data.content,
      is_user: true,
      is_system: false,
    };

    if (activeLeafId !== null) {
      addChild(tree, activeLeafId, userMsg);
    } else {
      // Empty tree — shouldn't happen since we create a greeting on chat creation,
      // but handle gracefully
      userMsg.parent_id = null;
      tree.set(userMsg.id, userMsg);
    }

    // Add auto-reply
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
    addChild(tree, userMsg.id, reply);

    // Persist: update parent, insert user msg, insert reply
    if (activeLeafId !== null) {
      const parentNode = getNode(tree, activeLeafId);
      repoUpdateMessage(user.id, data.chatId, activeLeafId, {
        children: parentNode.children,
        selectedChildLocalId: parentNode.selected_child_id,
      });
    }
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, userMsg));
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, reply));

    return {
      userMessage: messageToInsert(data.chatId, userMsg) as ChatMessageRow,
      assistantMessage: messageToInsert(data.chatId, reply) as ChatMessageRow,
    };
  });

export const regenerateMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    return { chatId: d.chatId };
  })
  .handler(async ({ data }): Promise<{ message: ChatMessageRow }> => {
    const { user } = await getSession();

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));

    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) throw new Error("No active message to regenerate");

    const currentReply = getNode(tree, activeLeafId);
    const parentId = currentReply.parent_id;
    if (parentId === null) throw new Error("Cannot regenerate root message");

    // Create new sibling
    const newReply: ChatMessage = {
      id: getNextId(tree),
      parent_id: null,
      children: [],
      selected_child_id: null,
      role: "assistant",
      name: currentReply.name,
      content: pickDefaultReply(rows.length + 1),
      is_user: false,
      is_system: false,
    };
    addSibling(tree, activeLeafId, newReply);

    // Auto-select the new reply
    const parent = getNode(tree, parentId);
    selectChild(tree, parentId, newReply.id);

    // Persist: update parent (children + selected), insert new reply
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selected_child_id,
    });
    repoInsertMessage(user.id, data.chatId, messageToInsert(data.chatId, newReply));

    return { message: messageToInsert(data.chatId, newReply) as ChatMessageRow };
  });

export const swipeMessage = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    if (d.direction !== "next" && d.direction !== "prev") throw new Error("direction must be 'next' or 'prev'");
    return { chatId: d.chatId, direction: d.direction as "next" | "prev" };
  })
  .handler(async ({ data }): Promise<SwipeResult> => {
    const { user } = await getSession();

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));

    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) throw new Error("No active message to swipe from");

    const siblingId =
      data.direction === "next"
        ? getNextSiblingId(tree, activeLeafId)
        : getPrevSiblingId(tree, activeLeafId);

    if (siblingId === null) {
      // No sibling in that direction; return current message unchanged
      const currentRow = rows.find((r) => r.localId === activeLeafId);
      if (!currentRow) throw new Error("Active message not found");
      return { selectedMessage: currentRow };
    }

    const current = getNode(tree, activeLeafId);
    const parentId = current.parent_id;
    if (parentId === null) throw new Error("Root message has no parent to swipe");

    selectChild(tree, parentId, siblingId);

    const parent = getNode(tree, parentId);
    repoUpdateMessage(user.id, data.chatId, parentId, {
      children: parent.children,
      selectedChildLocalId: parent.selected_child_id,
    });

    const selectedRow = rows.find((r) => r.localId === siblingId);
    if (!selectedRow) throw new Error("Selected sibling not found");
    return { selectedMessage: selectedRow };
  });

export const deleteChat = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") throw new Error("id is required");
    return { id: d.id };
  })
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { user } = await getSession();
    repoDeleteChat(user.id, data.id);
    return { id: data.id };
  });
