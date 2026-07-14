/** A single message in the chat tree. */
export interface ChatMessage {
  localId: number;
  parentLocalId: number | null;
  children: number[];
  selectedChildLocalId: number | null;
  role: "user" | "assistant" | "system";
  name?: string;
  content: string;
  isUser?: boolean;
  isSystem?: boolean;
  extra?: Record<string, unknown>;
}

/** Metadata attached to a chat. */
export interface ChatMetadata {
  active_leaf_id?: number | null;
  [key: string]: unknown;
}

/** Tree structure: Map of node ID → ChatMessage. */
export type ChatTree = Map<number, ChatMessage>;

/** A token counter abstraction. */
export interface ITokenCounter {
  count(text: string): number;
}

/** An event bus for pub/sub. */
export interface IEventBus {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}
