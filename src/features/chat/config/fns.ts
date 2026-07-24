import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/server/session";
import { loadChatConfig } from "./service";

const GetChatConfigSchema = Schema.Struct({
  chatId: Schema.String,
});

export const getChatConfigFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(GetChatConfigSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return loadChatConfig(user.id, data.chatId, user.name);
  });
