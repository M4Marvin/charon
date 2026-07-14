import type { ChatMessageRow, NewChatMessageRow } from "@/db/schema";
import type { ChatMessage } from "@/lib/st-core/shared/types";

export function rowToMessage(row: ChatMessageRow): ChatMessage {
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

export function messageToInsert(chatId: string, msg: ChatMessage): NewChatMessageRow {
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
