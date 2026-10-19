import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { appendUserAndReply, deleteBranch, editMessage, swipe } from "./service";

const SendMessageSchema = Schema.Struct({
  chatId: Schema.String,
  content: Schema.String,
});

const DeleteMessageSchema = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
});

const EditMessageSchema = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  content: Schema.String,
});

const SwipeSchema = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  direction: Schema.Literals(["next", "prev"]),
  createIfMissing: Schema.optional(
    Schema.Struct({
      role: Schema.Literals(["user", "assistant"]),
      content: Schema.String,
    }),
  ),
});

export const appendUserAndReplyFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(SendMessageSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return appendUserAndReply(data.chatId, data.content, "");
  });

export const deleteBranchFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(DeleteMessageSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return deleteBranch(data.chatId, data.messageLocalId);
  });

export const editMessageFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(EditMessageSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    editMessage(data.chatId, data.messageLocalId, data.content);
    return { messageLocalId: data.messageLocalId, content: data.content };
  });

export const swipeFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(SwipeSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return swipe(data.chatId, data.messageLocalId, data.direction, data.createIfMissing);
  });
