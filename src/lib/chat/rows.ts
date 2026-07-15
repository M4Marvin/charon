import type { ChatMessageRow, NewChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";

export function rowToMessage(row: ChatMessageRow): ChatMessage {
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

export function messageToInsert(chatId: string, msg: ChatMessage): NewChatMessageRow {
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
