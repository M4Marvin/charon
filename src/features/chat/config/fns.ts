import { Schema } from "effect";
import { createServerFn } from "@tanstack/react-start";
import { toClientConfig } from "./types";

const GetChatConfigSchema = Schema.Struct({
  chatId: Schema.String,
});

export const getChatConfigFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(GetChatConfigSchema)(data))
  .handler(async ({ data }) => {
    const [{ getSession }, { loadChatConfig }] = await Promise.all([
      import("@/server/session"),
      import("./service"),
    ]);
    const { user } = await getSession();
    const config = await loadChatConfig(user.id, data.chatId, user.name);
    return toClientConfig(config);
  });
