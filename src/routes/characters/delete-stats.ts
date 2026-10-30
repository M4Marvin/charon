export function characterDeleteDescription(
  name: string,
  chatCount: number,
  messageCount: number,
): string {
  const chats = chatCount === 1 ? "1 chat" : `${chatCount} chats`;
  const messages = messageCount === 1 ? "1 message" : `${messageCount} messages`;
  return `This permanently deletes “${name}”, ${chats}, and ${messages}. This cannot be undone.`;
}
