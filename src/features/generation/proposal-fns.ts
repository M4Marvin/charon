import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { getSession } from "@/server/session";
import { runProposal } from "./proposal";
import { acceptProposal, denyProposal, listProposals } from "./proposals";

const TriggerSchema = Schema.Literals(["impersonate", "image", "rewrite", "transform"]);

const RunProposalSchema = Schema.Struct({
  chatId: Schema.String,
  trigger: TriggerSchema,
  content: Schema.optional(Schema.String),
  messageLocalId: Schema.optional(Schema.Number),
  selection: Schema.optional(Schema.Array(Schema.Number)),
  instruction: Schema.optional(Schema.String),
});

const ProposalIdSchema = Schema.Struct({ proposalId: Schema.String });
const ChatIdSchema = Schema.Struct({ chatId: Schema.String });

export const runProposalFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(RunProposalSchema)(data))
  .handler(async ({ data }) => {
    const { user } = await getSession();
    return runProposal(user.id, user.name, {
      ...data,
      selection: data.selection ? [...data.selection] : undefined,
    });
  });

export const acceptProposalFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ProposalIdSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return acceptProposal(data.proposalId);
  });

export const denyProposalFn = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ProposalIdSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return denyProposal(data.proposalId);
  });

export const listProposalsFn = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data) => Schema.decodeUnknownSync(ChatIdSchema)(data))
  .handler(async ({ data }) => {
    await getSession();
    return listProposals(data.chatId);
  });
