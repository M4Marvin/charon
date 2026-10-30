export function characterDeleteDescription(chatCount: number, messageCount?: number): string {
  const chats = chatCount === 1 ? "1 chat" : `${chatCount} chats`;
  if (messageCount === undefined) {
    return `This permanently deletes this character and its ${chats}, including every message. This cannot be undone.`;
  }
  const messages = messageCount === 1 ? "1 message" : `${messageCount} messages`;
  return `This permanently deletes this character, ${chats}, and ${messages}. This cannot be undone.`;
}
