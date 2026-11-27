/**
 * Card status from the unified log: what the user last asked for, and what
 * comes next. Read-only.
 *
 *   pnpm card-kit next <card> [--json]
 *   pnpm card-kit log  <card> [-n 20] [--json]
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadGreetings, type Greeting } from "./vote";

export type LogEntry = {
  at: string;
  actor: "user" | "server";
  type: string;
  greeting?: string;
  input?: Record<string, unknown>;
  state?: Record<string, unknown>;
  note?: string;
  error?: string;
};

export type CardState = {
  name: string;
  confirmed: number;
  total: number;
  greetings: Greeting[];
  current: Greeting | null;
  next: { action: string; why: string } | null;
  entries: LogEntry[];
};

export async function readLog(dir: string, limit = 200): Promise<LogEntry[]> {
  const raw = await readFile(join(dir, "log.jsonl"), "utf8").catch(() => "");
  const entries: LogEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {
      // ignore a half-written line
    }
  }
  return entries.slice(-limit);
}

const says = (value: unknown) => (typeof value === "string" ? value : "");

const SIGNAL = new Set(["vote", "confirm", "reopen", "generate"]);

/** The newest input that actually asked for something. */
function lastFor(entries: LogEntry[], greeting?: string) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!SIGNAL.has(entry.type)) continue;
    if (!greeting || entry.greeting === greeting) return entry;
  }
  return null;
}

export async function cardState(dir: string, name: string, limit = 200): Promise<CardState> {
  const greetings = await loadGreetings(dir);
  const entries = await readLog(dir, limit);
  const confirmed = greetings.filter((g) => g.confirmed).length;
  const current = greetings.find((g) => !g.confirmed) ?? null;

  let next: CardState["next"] = null;
  const entry = current ? lastFor(entries, current.id) : lastFor(entries);
  // a round rendered after the last vote is that vote's answer: the next
  // move is the user's verdict, not another round
  const rendered = entry
    ? entries
        .slice(entries.lastIndexOf(entry) + 1)
        .some((item) => item.type === "takes" && !item.error)
    : false;

  if (current) {
    if (!current.finalised) {
      next = {
        action: `finalise G${Number(current.id)}`,
        why: current.text
          ? "writing exists; the image step unlocks on finalise"
          : "no text yet — write it before finalising",
      };
    } else if (current.takes.length === 0) {
      next = { action: `generate G${Number(current.id)}`, why: "finalised, no takes yet" };
    } else if (entry?.type === "vote" && entry.input?.more === false) {
      next = {
        action: `confirm G${Number(current.id)}`,
        why: "last vote closed the round; the pick is not locked yet",
      };
    } else if (entry?.type === "vote" && !rendered) {
      next = {
        action: `round ${current.rounds.length + 1} for G${Number(current.id)}`,
        why: says(entry.input?.comment) || "last vote asked for another round",
      };
    } else {
      next = {
        action: `vote on G${Number(current.id)}`,
        why: "takes are waiting; no vote on this round yet",
      };
    }
  }

  return { name, confirmed, total: greetings.length, greetings, current, next, entries };
}

export function formatState(state: CardState) {
  const lines: string[] = [];
  const head = `${state.name}  ·  ${state.confirmed}/${state.total} confirmed`;
  lines.push(head);
  if (state.next) {
    lines.push(`next: ${state.next.action}`);
    lines.push(`      ${state.next.why}`);
  } else {
    lines.push("next: nothing — every greeting has a confirmed image");
  }

  const current = state.current;
  if (current) {
    const last = lastFor(state.entries, current.id);
    lines.push("");
    const heading =
      current.plan
        ?.split("\n")[0]
        ?.replace(/^#\s*/, "")
        .replace(/^G\d+\s*·\s*/, "") ?? "";
    lines.push(`G${Number(current.id)}  ${heading}`);
    lines.push(
      `  takes ${current.takes.length} · rounds ${current.rounds.length} · final ${
        current.finalised ? "yes" : "no"
      } · confirmed ${current.confirmed ?? "—"}`,
    );
    if (last) {
      const picks = Array.isArray(last.input?.picks)
        ? (last.input?.picks as string[]).join(", ")
        : "—";
      lines.push(`  last ${last.type} ${last.at}${picks !== "—" ? ` · picks ${picks}` : ""}`);
      const comment = says(last.input?.comment);
      if (comment && comment !== state.next?.why) lines.push(`  “${comment}”`);
    }
  }

  lines.push("");
  for (const g of state.greetings ?? []) {
    const mark = g.confirmed ? "✓" : g.finalised ? "•" : "·";
    lines.push(`  ${mark} G${Number(g.id)}  ${g.confirmed ?? `${g.takes.length} takes`}`);
  }
  return lines.join("\n");
}

export function formatLog(entries: LogEntry[]) {
  return entries
    .map((entry) => {
      const bits = [entry.at, entry.actor, entry.type];
      if (entry.greeting) bits.push(`G${Number(entry.greeting)}`);
      const input = entry.input ?? {};
      if (Array.isArray(input.picks) && input.picks.length)
        bits.push(`picks ${(input.picks as string[]).join(",")}`);
      if (typeof input.more === "boolean") bits.push(input.more ? "more" : "done");
      if (entry.error) bits.push(`error: ${entry.error}`);
      const line = bits.join("  ");
      const comment = says(input.comment);
      return comment ? `${line}\n    “${comment}”` : line;
    })
    .join("\n");
}
