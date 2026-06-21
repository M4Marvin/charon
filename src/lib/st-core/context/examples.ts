/**
 * Parse example messages from a character card's mes_example field.
 * Examples are separated by <START> blocks.
 */
export function parseExampleMessages(examplesStr: string, exampleSeparator: string): string[] {
  if (!examplesStr || examplesStr.length === 0 || examplesStr === '<START>') {
    return [];
  }

  // Auto-prepend <START> if missing
  if (!examplesStr.startsWith('<START>')) {
    examplesStr = '<START>\n' + examplesStr.trim();
  }

  const blockHeading = `${exampleSeparator}\n`;
  const splitExamples = examplesStr
    .split(/<START>/gi)
    .slice(1)
    .map((block) => `${blockHeading}${block.trim()}\n`);

  return splitExamples;
}

/**
 * Parse example messages into individual chat-completion-style message objects.
 * Each block is split by alternating <user> and <char> name patterns.
 */
export interface ExampleMessage {
  role: 'user' | 'assistant';
  content: string;
  name?: string;
}

export function parseExampleBlocks(
  examplesStr: string,
  userName: string,
  charName: string,
): ExampleMessage[] {
  if (!examplesStr || examplesStr === '<START>') return [];

  const blocks = examplesStr
    .split(/<START>/gi)
    .map((b) => b.trim())
    .filter(Boolean);

  const messages: ExampleMessage[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    for (const line of lines) {
      const userPrefix = `${userName}: `;
      const charPrefix = `${charName}: `;
      if (line.startsWith(userPrefix)) {
        messages.push({
          role: 'user',
          content: line.slice(userPrefix.length),
          name: userName,
        });
      } else if (line.startsWith(charPrefix)) {
        messages.push({
          role: 'assistant',
          content: line.slice(charPrefix.length),
          name: charName,
        });
      }
    }
  }

  return messages;
}
