import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

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
  selection: Schema.optional(Schema.Array(Schema.Number)),
});

const CancelSchema = Schema.Struct({ jobId: Schema.String });

export const prepareGenerationFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(PrepareSchema)(data))
  .handler(async ({ data }) => {
    const [{ getSession }, { runGeneration, withGenerationService }] = await Promise.all([
      import("@/server/session"),
      import("./service"),
    ]);
    const { user } = await getSession();
    const prepared = await runGeneration(
      withGenerationService((service) =>
        service.prepare(
          user.id,
          { ...data, selection: data.selection ? [...data.selection] : undefined },
          user.name,
        ),
      ),
    );
    return {
      ...prepared,
      streamPath: "/api/generation/chat",
    };
  });

export const cancelGenerationFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(CancelSchema)(data))
  .handler(async ({ data }) => {
    const [{ getSession }, { getJob, cancelJob }, { deleteBranch }] = await Promise.all([
      import("@/server/session"),
      import("@/db/repositories/generation"),
      import("@/features/chat/tree/service"),
    ]);
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
