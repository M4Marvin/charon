import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { prepareStream, finalizeStream, cancelStream } from "./service";
import { impersonateMessage } from "./impersonate";
import { generateImagePrompt } from "./image-prompt";

const PrepareStreamSchema = Schema.Struct({
  chatId: Schema.String,
  mode: Schema.Literal("send", "regenerate", "continue"),
  content: Schema.optional(Schema.String),
  messageLocalId: Schema.optional(Schema.Number),
});

const FinalizeStreamSchema = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
  content: Schema.String,
});

const CancelStreamSchema = Schema.Struct({
  chatId: Schema.String,
  messageLocalId: Schema.Number,
});

export const prepareStreamFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(PrepareStreamSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return prepareStream(user.id, data, user.name);
  });

export const finalizeStreamFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(FinalizeStreamSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return finalizeStream(user.id, data.chatId, data.messageLocalId, data.content, user.name);
  });

export const cancelStreamFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(CancelStreamSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return cancelStream(user.id, data.chatId, data.messageLocalId);
  });

const ImpersonateSchema = Schema.Struct({
  chatId: Schema.String,
});

export const impersonateFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ImpersonateSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return impersonateMessage(user.id, data.chatId, user.name);
  });

const ImagePromptSchema = Schema.Struct({
  chatId: Schema.String,
});

export const imagePromptFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ImagePromptSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return generateImagePrompt(user.id, data.chatId, user.name);
  });
