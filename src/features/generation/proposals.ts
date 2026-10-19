import { db as defaultDb, type DB } from "@/db";
import {
  getProposal,
  getJob,
  listPendingProposals,
  resolveProposal,
  insertRevision,
} from "@/db/repositories/generation";
import { getMessage, updateMessage } from "@/db/repositories/chats";
import { appendMessage } from "@/features/chat/tree/service";
import { StaleTargetError, GenerationValidationError } from "./errors";
import { contentHash } from "@/lib/chat/content-hash";
import type { ProposalView } from "./contract";

export function toProposalView(row: ReturnType<typeof getProposal>): ProposalView | null {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    chatId: row.chatId,
    kind: row.kind,
    status: row.status,
    targetLocalId: row.targetLocalId,
    baseRev: row.baseRev,
    baseHash: row.baseHash,
    proposedContent: row.proposedContent,
    proposedRole: row.proposedRole,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function listProposals(chatId: string, db: DB = defaultDb): ProposalView[] {
  return listPendingProposals(chatId, db)
    .map((row) => toProposalView(row))
    .filter((row): row is ProposalView => row !== null);
}

export function acceptProposal(
  proposalId: string,
  db: DB = defaultDb,
): { ok: true; proposal: ProposalView; messageLocalId: number | null } {
  return db.transaction((tx) => {
    const proposal = getProposal(proposalId, tx);
    if (!proposal) throw new GenerationValidationError({ message: "Proposal not found" });
    if (proposal.status !== "pending") {
      throw new GenerationValidationError({ message: "Proposal is no longer pending" });
    }
    const job = getJob(proposal.jobId, tx);
    if (!job) throw new GenerationValidationError({ message: "Proposal job not found" });

    if (proposal.kind === "impersonate" || proposal.kind === "image") {
      const updated = resolveProposal(proposalId, "accepted", tx);
      if (!updated) throw new GenerationValidationError({ message: "Proposal changed" });
      return { ok: true, proposal: toProposalView(updated)!, messageLocalId: null };
    }

    if (proposal.kind === "rewrite") {
      const targetId = proposal.targetLocalId ?? 0;
      const existing = getMessage(proposal.chatId, targetId, tx);
      if (!existing) throw new GenerationValidationError({ message: "Target message not found" });
      const extra = (existing.extra ?? {}) as Record<string, unknown>;
      const actualRev = Number(extra.rev ?? 0);
      if (proposal.baseRev !== null && actualRev !== proposal.baseRev) {
        throw new StaleTargetError({
          message: "The message changed since the rewrite started.",
          expectedRev: proposal.baseRev,
          actualRev,
        });
      }
      if (proposal.baseHash && contentHash(existing.content) !== proposal.baseHash) {
        throw new StaleTargetError({
          message: "The message content changed since the rewrite started.",
          expectedRev: proposal.baseRev ?? actualRev,
          actualRev,
        });
      }
      const nextRev = actualRev + 1;
      updateMessage(
        proposal.chatId,
        targetId,
        {
          content: proposal.proposedContent,
          extra: {
            ...extra,
            rev: nextRev,
            contentHash: contentHash(proposal.proposedContent),
            generationJobId: job.id,
          },
        },
        tx,
      );
      insertRevision(
        {
          chatId: proposal.chatId,
          messageLocalId: targetId,
          rev: actualRev,
          content: existing.content,
          source: "rewrite",
          jobId: job.id,
        },
        tx,
      );
      const updated = resolveProposal(proposalId, "accepted", tx);
      if (!updated) throw new GenerationValidationError({ message: "Proposal changed" });
      return { ok: true, proposal: toProposalView(updated)!, messageLocalId: targetId };
    }

    // transform: append the proposed text as a new assistant message at the
    // active leaf. The source messages are never mutated.
    const created = appendMessage(
      proposal.chatId,
      {
        role: "assistant",
        content: proposal.proposedContent,
        extra: {
          generationJobId: job.id,
          proposalId: proposal.id,
          kind: "transform",
          source: job.input?.selection ?? [],
        },
      },
      tx,
    );
    const updated = resolveProposal(proposalId, "accepted", tx);
    if (!updated) throw new GenerationValidationError({ message: "Proposal changed" });
    return { ok: true, proposal: toProposalView(updated)!, messageLocalId: created.localId };
  });
}

export function denyProposal(proposalId: string, db: DB = defaultDb): { ok: true } {
  const updated = resolveProposal(proposalId, "rejected", db);
  if (!updated) {
    const existing = getProposal(proposalId, db);
    if (!existing) throw new GenerationValidationError({ message: "Proposal not found" });
  }
  return { ok: true };
}
