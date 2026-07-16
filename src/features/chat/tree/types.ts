import type { ChatMessage } from "@/lib/st-core/shared/types";

export type { ChatMessage };

export interface NewMessage {
  role: "user" | "assistant";
  content: string;
  extra?: Record<string, unknown>;
}

export interface SiblingContent {
  role: "user" | "assistant";
  content: string;
  extra?: Record<string, unknown>;
}

export interface ActivePathEntry {
  message: ChatMessage;
  siblingIndex: number;
  siblingTotal: number;
}

export interface CreateChatInput {
  characterId: string;
  title: string;
  greetings: string[];
  characterDescription?: string;
  characterPersonality?: string;
  characterScenario?: string;
  characterSystemPrompt?: string;
}

export interface SwipeResult {
  selectedMessage: ChatMessage;
  created: boolean;
}

export interface ChatLockState {
  lock: "generating";
  messageId: number;
  lockedAt: number;
}

export interface ChatDetail {
  id: string;
  characterId: string;
  title: string;
  characterDescription: string;
  characterPersonality: string;
  characterScenario: string;
  characterSystemPrompt: string;
  backgroundId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lockState: "idle" | "generating";
  lockMessageLocalId: number | null;
}
