import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import type { ChatMessageRow, NewChatMessageRow, Character } from "@/db/schema";
import {
  createChat as repoCreateChat,
  deleteChat as repoDeleteChat,
  deleteMessages as repoDeleteMessages,
  getChat as repoGetChat,
  insertMessage as repoInsertMessage,
  listChats as repoListChats,
  listMessages as repoListMessages,
  updateMessage as repoUpdateMessage,
  type ChatWithCharacter,
} from "@/db/repositories/chats";
import { getCharacter as repoGetChar } from "@/db/repositories/characters";
import type { ChatMessage, ChatTree } from "@/lib/st-core/shared/types";
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
    return { characterId: d.characterId };
  })
  .handler(async ({ data }): Promise<ChatDetail> => {
    const { user } = await getSession();
    const char: Character = repoGetChar(user.id, data.characterId);

    const chatId = randomUUID();
    const chat = repoCreateChat({
      id: chatId,
      userId: user.id,
      characterId: data.characterId,
      title: char.data.name,
    });

    // Collect all greetings: first_mes + every alternate_greeting.
    const greetingTexts: string[] = [];
    if (char.data.first_mes) greetingTexts.push(char.data.first_mes);
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
        content: text,
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

    const chat = repoGetChat(user.id, data.chatId);
    const char: Character = repoGetChar(user.id, chat.characterId);

    const rows = repoListMessages(user.id, data.chatId);
    const tree = treeFromNodes(rows.map(rowToMessage));
    const activeLeafId = getActiveLeafId(tree);
    if (activeLeafId === null) throw new Error("No active message to send from");

    const activeLeaf = getNode(tree, activeLeafId);
    const isDraft = (activeLeaf.extra?.isDraft ?? false) === true;

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
        content: data.content,
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
      content: data.content,
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
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    if (typeof d.messageLocalId !== "number") throw new Error("messageLocalId is required");
    if (d.direction !== "next" && d.direction !== "prev")
      throw new Error("direction must be 'next' or 'prev'");
    return {
      chatId: d.chatId,
      messageLocalId: d.messageLocalId,
      direction: d.direction as "next" | "prev",
    };
  })
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
          name: target.name,
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
          content: pickDefaultReply(rows.length + 1),
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
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    if (typeof d.messageLocalId !== "number") throw new Error("messageLocalId is required");
    return { chatId: d.chatId, messageLocalId: d.messageLocalId };
  })
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
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.chatId !== "string") throw new Error("chatId is required");
    if (typeof d.messageLocalId !== "number") throw new Error("messageLocalId is required");
    if (typeof d.content !== "string") throw new Error("content is required");
    return { chatId: d.chatId, messageLocalId: d.messageLocalId, content: d.content };
  })
  .handler(
    async ({ data }): Promise<{ messageLocalId: number; content: string }> => {
      if (data.messageLocalId === 0) throw new Error("Cannot edit the hidden root");
      const { user } = await getSession();

      // Verify the message exists in this chat (also enforces ownership).
      const existing = repoListMessages(user.id, data.chatId).find(
        (r) => r.localId === data.messageLocalId,
      );
      if (!existing) throw new Error("Message not found");

      repoUpdateMessage(user.id, data.chatId, data.messageLocalId, { content: data.content });
      return { messageLocalId: data.messageLocalId, content: data.content };
    },
  );

export const deleteChat = createServerFn({ method: "POST", strict: { output: false } })
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
