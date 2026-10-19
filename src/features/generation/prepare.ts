import { db as defaultDb, type DB } from "@/db";
import { createJob, failJob, getJob, setJobPlaceholder, cancelJob } from "@/db/repositories/generation";
import {
  appendMessage,
  appendSibling,
  appendUserAndReply,
  getMessages,
} from "@/features/chat/tree/service";
import { treeFromNodes } from "@/lib/st-core/chat-tree/tree-io";
import { getActiveLeafId, getNode } from "@/lib/st-core/chat-tree/tree";
import { loadChatConfig } from "@/features/chat/config/service";
import { getMessage, updateMessage } from "@/db/repositories/chats";
import { substituteMessageMacros } from "@/lib/chat/substitute-message-macros";
import { ConfigError, GenerationValidationError } from "./errors";
import type { Trigger, InsertionTarget } from "./contract";

export interface PrepareGenerationInput {
  chatId: string;
  requestId?: string;
  trigger: Trigger;
  content?: string;
  messageLocalId?: number;
  selection?: number[];
}

export interface PreparedGeneration {
  jobId: string;
  placeholderLocalId: number;
  userLocalId: number | null;
  requestId: string;
}

function modeFor(trigger: Trigger): "chat" | "impersonate" | "image" | "rewrite" | "transform" {
  switch (trigger) {
    case "impersonate":
      return "impersonate";
    case "image":
      return "image";
    case "rewrite":
      return "rewrite";
    case "transform":
      return "transform";
    default:
      return "chat";
  }
}

export async function prepareGeneration(
  userId: string,
  input: PrepareGenerationInput,
  userName: string,
  db: DB = defaultDb,
): Promise<PreparedGeneration> {
  if (!input.chatId) throw new GenerationValidationError({ message: "chatId is required" });
  const requestId = input.requestId ?? crypto.randomUUID();
  const config = await loadChatConfig(userId, input.chatId, userName, db);
  if (!config.provider) {
    throw new ConfigError({
      message: "No AI provider/model is configured for this chat.",
    });
  }

  // The v1 engine used a 5-minute message-keyed root lock. The new engine owns
  // concurrency in generation_jobs; clear any inherited lock before writing.
  const root = getMessage(input.chatId, 0, db);
  if (root?.extra && (root.extra as Record<string, unknown>).lock === "generating") {
    updateMessage(input.chatId, 0, { extra: null }, db);
  }

  const messages = getMessages(input.chatId, db);
  const tree = treeFromNodes(messages);
  const activeLeafId = getActiveLeafId(tree);
  if (activeLeafId === null) throw new GenerationValidationError({ message: "No active message" });

  let target: InsertionTarget = { kind: "append" };
  const messageLocalId = input.messageLocalId;
  const selection = input.selection ?? [];

  if (input.trigger === "regenerate") {
    const targetId = messageLocalId ?? 0;
    if (targetId <= 0) throw new GenerationValidationError({ message: "Cannot regenerate root" });
    const targetNode = getNode(tree, targetId);
    if (!targetNode || targetNode.role !== "assistant") {
      throw new GenerationValidationError({ message: "Can only regenerate assistant messages" });
    }
    target = { kind: "sibling", messageLocalId: targetId };
  } else if (input.trigger === "continue") {
    const leaf = getNode(tree, activeLeafId);
    if (!leaf || leaf.localId === 0) {
      throw new GenerationValidationError({ message: "No active message to continue from" });
    }
    target = leaf.role === "assistant"
      ? { kind: "sibling", messageLocalId: leaf.localId }
      : { kind: "append" };
  } else if (input.trigger === "rewrite") {
    const targetId = messageLocalId ?? selection[0];
    if (!targetId) {
      throw new GenerationValidationError({ message: "A message is required to rewrite" });
    }
    const targetNode = getNode(tree, targetId);
    if (!targetNode) throw new GenerationValidationError({ message: "Message not found" });
    const extra = (targetNode.extra ?? {}) as Record<string, unknown>;
    target = {
      kind: "replace",
      messageLocalId: targetId,
      baseRev: Number(extra.rev ?? 0),
      baseHash: String(extra.contentHash ?? ""),
    };
  } else if (input.trigger === "transform") {
    const last = selection[selection.length - 1] ?? messageLocalId ?? activeLeafId;
    target = { kind: "insertAfter", messageLocalId: last, role: "assistant" };
  }

  const job = createJob(
    {
      requestId,
      chatId: input.chatId,
      trigger: input.trigger,
      promptMode: modeFor(input.trigger),
      baseLeafId: activeLeafId,
      target,
      input: {
        content: input.content,
        messageLocalId,
        selection,
      },
      requiresConfirmation:
        input.trigger === "rewrite" || input.trigger === "transform" || input.trigger === "image",
    },
    db,
  );

  try {
    if (input.trigger === "send") {
      const content = input.content?.trim() ?? "";
      if (!content) throw new GenerationValidationError({ message: "Content is required" });
      const macroEnv = {
        char: config.character.name,
        user: config.persona.name,
      };
      const userContent = substituteMessageMacros(content, macroEnv);
      const { userMessage, replyMessage } = appendUserAndReply(
        input.chatId,
        userContent,
        "",
        { isStreaming: true, generationJobId: job.id },
        db,
      );
      setJobPlaceholder(job.id, replyMessage.localId, activeLeafId, db);
      return {
        jobId: job.id,
        placeholderLocalId: replyMessage.localId,
        userLocalId: userMessage.localId,
        requestId,
      };
    }

    if (input.trigger === "regenerate" || input.trigger === "continue") {
      const targetId = input.trigger === "regenerate" ? (messageLocalId ?? 0) : activeLeafId;
      const leaf = getNode(tree, activeLeafId);
      const created = leaf?.role === "assistant" || input.trigger === "regenerate"
        ? appendSibling(
            input.chatId,
            targetId,
            { role: "assistant", content: "", extra: { isStreaming: true, generationJobId: job.id } },
            db,
          )
        : appendMessage(
            input.chatId,
            { role: "assistant", content: "", extra: { isStreaming: true, generationJobId: job.id } },
            db,
          );
      setJobPlaceholder(job.id, created.localId, activeLeafId, db);
      return {
        jobId: job.id,
        placeholderLocalId: created.localId,
        userLocalId: null,
        requestId,
      };
    }

    setJobPlaceholder(job.id, 0, activeLeafId, db);
    return { jobId: job.id, placeholderLocalId: 0, userLocalId: null, requestId };
  } catch (error) {
    const jobRow = getJob(job.id, db);
    if (jobRow) failJob({ jobId: job.id, code: "prepare_failed", message: (error as Error).message }, db);
    throw error;
  }
}

export function cancelPreparedGeneration(jobId: string, db: DB = defaultDb): void {
  cancelJob(jobId, db);
}
