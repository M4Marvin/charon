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
  trigger: TriggerSchema,
  content: Schema.optional(Schema.String),
  messageLocalId: Schema.optional(Schema.Number),
  selection: Schema.optional(Schema.Array(Schema.Number)),
});

const CancelSchema = Schema.Struct({ jobId: Schema.String });

export const prepareGenerationFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(PrepareSchema)(data))
  .handler(async ({ data }) => {
    const [{ getSession }, { prepareGeneration }] = await Promise.all([
      import("@/server/session"),
      import("./prepare"),
    ]);
    const { user } = await getSession();
    const prepared = await prepareGeneration(
      user.id,
      { ...data, selection: data.selection ? [...data.selection] : undefined },
      user.name,
    );
    return prepared;
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
    const cancelled = cancelJob(data.jobId);
    // A finalized run is no longer cancellable; deleting its placeholder now
    // would delete the completed reply.
    if (cancelled && job?.placeholderLocalId && job.placeholderLocalId > 0) {
      try {
        deleteBranch(job.chatId, job.placeholderLocalId);
      } catch {
        // The branch may already be gone; the job is still cancelled.
      }
    }
    return { ok: true };
  });
