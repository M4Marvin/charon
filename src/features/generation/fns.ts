import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { getSession } from "@/server/session";
import { runGeneration, withGenerationService } from "./service";
import { getJob } from "@/db/repositories/generation";
import { deleteBranch } from "@/features/chat/tree/service";
import { cancelJob } from "@/db/repositories/generation";

const TriggerSchema = Schema.Literals([
  "send",
  "regenerate",
  "continue",
  "impersonate",
  "image",
  "rewrite",
  "transform",
]);

const PrepareSchema = Schema.Struct({
  chatId: Schema.String,
  requestId: Schema.optional(Schema.String),
  trigger: TriggerSchema,
  content: Schema.optional(Schema.String),
  messageLocalId: Schema.optional(Schema.Number),
});

const CancelSchema = Schema.Struct({ jobId: Schema.String });

export const prepareGenerationFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(PrepareSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    const prepared = await runGeneration(
      withGenerationService((service) => service.prepare(user.id, data, user.name)),
    );
    return {
      ...prepared,
      streamPath: "/api/generation/chat",
    };
  });

export const cancelGenerationFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(CancelSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    const job = getJob(data.jobId);
    cancelJob(data.jobId);
    if (job?.placeholderLocalId && job.placeholderLocalId > 0) {
      try {
        deleteBranch(job.chatId, job.placeholderLocalId, undefined, { skipIdleCheck: true });
      } catch {
        // The run may have finalized first; keep its content.
      }
    }
    return { ok: true };
  });
