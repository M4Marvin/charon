import { randomUUID } from "node:crypto";
import type { ChatTree, ChatMessage } from "@/lib/st-core/shared/types";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import {
  getActiveLeafId,
  getNode,
} from "@/lib/st-core/chat-tree/tree";
import type { ChatMessageRow, NewChatMessageRow } from "@/db/schema";
import {
  getChat as repoGetChat,
  createChat as repoCreateChat,
  listChats as repoListChats,
  listMessages as repoListMessages,
  insertMessage as repoInsertMessage,
  updateMessage as repoUpdateMessage,
  deleteMessages as repoDeleteMessages,
  deleteChat as repoDeleteChat,
  getMessage as repoGetMessage,
} from "@/db/repositories/chats";
import type { ChatWithCharacter } from "@/db/repositories/chats";
import type { DB } from "@/db";
import { db as defaultDb } from "@/db";
import { computeActivePathFromMessages, getPathToNode } from "./active-path";
import { ensureChatIdle } from "./lock";
import {
  appendChild,
  selectSibling,
  createSiblingAndSelect,
  removeBranch,
} from "./operations";
import type {
  ChatDetail,
  CreateChatInput,
  NewMessage,
  SiblingContent,
  SwipeResult,
  ActivePathEntry,
} from "./types";

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    localId: row.localId,
    parentLocalId: row.parentLocalId,
    children: row.children ?? [],
    selectedChildLocalId: row.selectedChildLocalId,
    role: row.role,
    content: row.content,
    extra: row.extra ?? undefined,
  };
}

function messageToRow(chatId: string, msg: ChatMessage): NewChatMessageRow {
  return {
    chatId,
    localId: msg.localId,
    parentLocalId: msg.parentLocalId,
    children: msg.children,
    selectedChildLocalId: msg.selectedChildLocalId,
    role: msg.role,
    content: msg.content,
    extra: msg.extra ?? null,
  };
}

function loadTree(userId: string, chatId: string, db: DB): ChatTree {
  const rows = repoListMessages(userId, chatId, db);
  return treeFromNodes(rows.map(rowToMessage));
}

function persistParent(
  userId: string,
  chatId: string,
  tree: ChatTree,
  parentId: number,
  db: DB,
): void {
  const parent = getNode(tree, parentId);
  repoUpdateMessage(userId, chatId, parentId, {
    children: parent.children,
    selectedChildLocalId: parent.selectedChildLocalId,
  }, db);
}

function persistNewMessage(
  userId: string,
  chatId: string,
  message: ChatMessage,
  db: DB,
): void {
  repoInsertMessage(userId, chatId, messageToRow(chatId, message), db);
}

// ── Reads ──

export function listChats(
  userId: string,
  db: DB = defaultDb,
): ChatWithCharacter[] {
  return repoListChats(userId, db);
}

export function getChat(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): ChatDetail {
  const chat = repoGetChat(userId, chatId, db);
  const root = repoGetMessage(userId, chatId, 0, db);
  const lockExtra = root?.extra;
  const isGenerating = lockExtra?.lock === "generating";

  return {
    id: chat.id,
    characterId: chat.characterId,
    title: chat.title,
    characterDescription: chat.characterDescription,
    characterPersonality: chat.characterPersonality,
    characterScenario: chat.characterScenario,
    characterSystemPrompt: chat.characterSystemPrompt,
    backgroundId: chat.backgroundId ?? null,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lockState: isGenerating ? "generating" : "idle",
    lockMessageLocalId: isGenerating
      ? (lockExtra!.messageId as number)
      : null,
  };
}

export function getMessages(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): ChatMessage[] {
  return repoListMessages(userId, chatId, db).map(rowToMessage);
}

export function getActivePath(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): ActivePathEntry[] {
  const messages = getMessages(userId, chatId, db);
  return computeActivePathFromMessages(messages);
}

export function getPathToMessage(
  userId: string,
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): ChatMessage[] {
  const tree = loadTree(userId, chatId, db);
  return getPathToNode(tree, messageLocalId);
}

// ── Chat lifecycle ──

export function createChat(
  userId: string,
  input: CreateChatInput,
  db: DB = defaultDb,
): ChatDetail {
  if (input.greetings.length === 0) {
    throw new Error("createChat: at least one greeting is required");
  }

  const chatId = randomUUID();

  const chat = repoCreateChat({
    id: chatId,
    userId,
    characterId: input.characterId,
    title: input.title,
    characterDescription: input.characterDescription ?? "",
    characterPersonality: input.characterPersonality ?? "",
    characterScenario: input.characterScenario ?? "",
    characterSystemPrompt: input.characterSystemPrompt ?? "",
  }, db);

  repoInsertMessage(userId, chatId, {
    chatId,
    localId: 0,
    parentLocalId: null,
    children: input.greetings.map((_, i) => i + 1),
    selectedChildLocalId: 1,
    role: "system",
    content: "",
    extra: null,
  }, db);

  input.greetings.forEach((text, i) => {
    repoInsertMessage(userId, chatId, {
      chatId,
      localId: i + 1,
      parentLocalId: 0,
      children: [],
      selectedChildLocalId: null,
      role: "assistant",
      content: text,
      extra: null,
    }, db);
  });

  return {
    id: chat.id,
    characterId: chat.characterId,
    title: chat.title,
    characterDescription: chat.characterDescription,
    characterPersonality: chat.characterPersonality,
    characterScenario: chat.characterScenario,
    characterSystemPrompt: chat.characterSystemPrompt,
    backgroundId: chat.backgroundId ?? null,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lockState: "idle",
    lockMessageLocalId: null,
  };
}

export function deleteChat(
  userId: string,
  chatId: string,
  db: DB = defaultDb,
): void {
  repoDeleteChat(userId, chatId, db);
}

// ── Message operations ──

export function appendMessage(
  userId: string,
  chatId: string,
  msg: NewMessage,
  db: DB = defaultDb,
): ChatMessage {
  ensureChatIdle(userId, chatId, db);
  const rows = repoListMessages(userId, chatId, db);
  const tree = treeFromNodes(rows.map(rowToMessage));
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) {
    throw new Error("No active message to append to");
  }

  const newNode = appendChild(tree, activeLeafId, msg);
  persistParent(userId, chatId, tree, activeLeafId, db);
  persistNewMessage(userId, chatId, newNode, db);
  return newNode;
}

export function appendUserAndReply(
  userId: string,
  chatId: string,
  userContent: string,
  replyContent: string,
  replyExtra?: Record<string, unknown>,
  db: DB = defaultDb,
): { userMessage: ChatMessage; replyMessage: ChatMessage } {
  if (userContent.length === 0) {
    throw new Error("User content cannot be empty");
  }
  ensureChatIdle(userId, chatId, db);

  const rows = repoListMessages(userId, chatId, db);
  const tree = treeFromNodes(rows.map(rowToMessage));
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) {
    throw new Error("No active message to append to");
  }

  const userMessage = appendChild(tree, activeLeafId, {
    role: "user",
    content: userContent,
  });
  persistParent(userId, chatId, tree, activeLeafId, db);
  persistNewMessage(userId, chatId, userMessage, db);

  const replyMessage = appendChild(tree, userMessage.localId, {
    role: "assistant",
    content: replyContent,
    ...(replyExtra ? { extra: replyExtra } : {}),
  });
  persistParent(userId, chatId, tree, userMessage.localId, db);
  persistNewMessage(userId, chatId, replyMessage, db);

  return { userMessage, replyMessage };
}

export function swipe(
  userId: string,
  chatId: string,
  messageLocalId: number,
  direction: "next" | "prev",
  createIfMissing?: SiblingContent,
  db: DB = defaultDb,
): SwipeResult {
  ensureChatIdle(userId, chatId, db);
  const rows = repoListMessages(userId, chatId, db);
  const tree = treeFromNodes(rows.map(rowToMessage));

  const existing = selectSibling(tree, messageLocalId, direction);
  if (existing !== null || direction === "prev") {
    if (existing !== null) {
      persistParent(userId, chatId, tree, existing.parentLocalId!, db);
    }
    return {
      selectedMessage: existing ?? getNode(tree, messageLocalId),
      created: false,
    };
  }

  if (!createIfMissing) {
    return {
      selectedMessage: getNode(tree, messageLocalId),
      created: false,
    };
  }

  const target = getNode(tree, messageLocalId);
  const parentId = target.parentLocalId!;
  const newSibling = createSiblingAndSelect(
    tree,
    messageLocalId,
    createIfMissing,
  );
  persistParent(userId, chatId, tree, parentId, db);
  persistNewMessage(userId, chatId, newSibling, db);
  return { selectedMessage: newSibling, created: true };
}

export function deleteBranch(
  userId: string,
  chatId: string,
  messageLocalId: number,
  db: DB = defaultDb,
): { deletedIds: number[] } {
  if (messageLocalId === 0) {
    throw new Error("Cannot delete the hidden root (localId 0)");
  }
  ensureChatIdle(userId, chatId, db);
  const rows = repoListMessages(userId, chatId, db);
  const tree = treeFromNodes(rows.map(rowToMessage));
  const target = getNode(tree, messageLocalId);
  if (target.parentLocalId === null) {
    throw new Error("Cannot delete the root message");
  }
  const parentId = target.parentLocalId;
  const deletedIds = removeBranch(tree, messageLocalId);
  persistParent(userId, chatId, tree, parentId, db);
  repoDeleteMessages(userId, chatId, deletedIds, db);
  return { deletedIds };
}

export function editMessage(
  userId: string,
  chatId: string,
  messageLocalId: number,
  content: string,
  db: DB = defaultDb,
): void {
  if (messageLocalId === 0) {
    throw new Error("Cannot edit the hidden root");
  }
  ensureChatIdle(userId, chatId, db);
  const msg = repoListMessages(userId, chatId, db).find(
    (r) => r.localId === messageLocalId,
  );
  if (!msg) throw new Error("Message not found");
  repoUpdateMessage(userId, chatId, messageLocalId, { content }, db);
}
