#!/usr/bin/env tsx
/**
 * MCP server for character cards held in memory.
 *
 * One process per agent session: `card_open` reads the PNG once, every later
 * call edits the in-memory copy, `card_save` writes it back. Node-only.
 *
 *   pnpm mcp:card
 *
 * stdio transport, so stdout carries JSON-RPC only — log to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  buildPayloadFromCard,
  buildReport,
  buildSubmitPayload,
  editUrlFor,
  EDIT_SCRIPT,
  publishedUrl,
  checkCard,
  checkImageUrls,
  loadCard,
  renderCard,
  SUBMIT_SCRIPT,
} from "@/lib/cardkit";
import { CardSession } from "@/lib/character/card-session.js";

const sessions = new Map<string, CardSession>();

const key = (path: string) => resolve(path);

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (error: unknown) => ({
  content: [
    { type: "text" as const, text: error instanceof Error ? error.message : String(error) },
  ],
  isError: true,
});

function session(path: string): CardSession {
  const found = sessions.get(key(path));
  if (!found) throw new Error(`card not open: ${path} (call card_open first)`);
  return found;
}

async function open(path: string): Promise<CardSession> {
  const existing = sessions.get(key(path));
  if (existing) return existing;
  const created = await CardSession.open(key(path));
  sessions.set(key(path), created);
  return created;
}

function outDirFor(dir: string): string {
  return join(dirname(dir), ".cardkit", basename(dir));
}

const server = new McpServer({ name: "charon-cards", version: "0.1.0" });

server.registerTool(
  "card_open",
  {
    description:
      "Load a character card PNG into memory. Returns a summary. Call once per file; later calls reuse the open copy.",
    inputSchema: { path: z.string().describe("path to the card PNG") },
  },
  async ({ path }) => {
    try {
      return text((await open(path)).summary());
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_list",
  {
    description:
      "List the cards currently open in this session and whether they have unsaved changes.",
    inputSchema: {},
  },
  () => {
    if (!sessions.size) return text("no cards open");
    return text(
      [...sessions.values()]
        .map((item) => `${item.file}${item.dirty ? " (unsaved changes)" : ""}`)
        .join("\n"),
    );
  },
);

server.registerTool(
  "card_show",
  {
    description:
      "Summary of an open card: spec, name, creator, tags, greeting count, image count, field sizes.",
    inputSchema: { path: z.string().describe("path to the card PNG") },
  },
  ({ path }) => {
    try {
      return text(session(path).summary());
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_get",
  {
    description:
      "Read one field from an open card. Field paths use dots and indexes: data.name, data.alternate_greetings[2], data.character_book.entries[0].content.",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      field: z.string().describe("field path, e.g. data.name"),
    },
  },
  ({ path, field }) => {
    try {
      const value = session(path).get(field);
      return text(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_set",
  {
    description:
      "Set one field on an open card (in memory; call card_save to write the PNG). Values that parse as JSON are stored as JSON, everything else as a string.",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      field: z.string().describe("field path, e.g. data.name"),
      value: z.unknown().describe("new value"),
    },
  },
  ({ path, field, value }) => {
    try {
      session(path).set(field, value);
      return text(`set ${field} (unsaved)`);
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_unset",
  {
    description: "Delete one field from an open card (in memory; call card_save to write the PNG).",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      field: z.string().describe("field path, e.g. data.mes_example"),
    },
  },
  ({ path, field }) => {
    try {
      session(path).unset(field);
      return text(`unset ${field} (unsaved)`);
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_json",
  {
    description:
      "Write the open card JSON to .cardkit/<name>/card.json and return the path. inline=true returns the JSON in the response instead (large).",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      inline: z.boolean().optional().describe("return the JSON inline instead of writing a file"),
    },
  },
  async ({ path, inline }) => {
    try {
      const card = session(path);
      if (inline) return text(card.json());
      const out = join(dirname(card.file), ".cardkit", basename(card.file, ".png"));
      await mkdir(out, { recursive: true });
      const file = join(out, "card.json");
      await writeFile(file, card.json());
      return text(`${file} (${card.json().length} bytes)`);
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_save",
  {
    description:
      "Write the in-memory card back into the PNG. In place by default and keeps a .bak copy; pass out to write a new file instead.",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      out: z.string().optional().describe("write to this file instead of the original"),
      backup: z.boolean().optional().describe("keep <file>.bak on in-place saves (default true)"),
    },
  },
  async ({ path, out, backup }) => {
    try {
      return text(`wrote ${await session(path).save(out, backup ?? true)}`);
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_reload",
  {
    description: "Discard unsaved changes and re-read the card from the PNG.",
    inputSchema: { path: z.string().describe("path to the card PNG") },
  },
  async ({ path }) => {
    try {
      await session(path).reload();
      return text("reloaded from disk");
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_close",
  {
    description: "Drop an open card from memory. Unsaved changes are discarded.",
    inputSchema: { path: z.string().describe("path to the card PNG") },
  },
  ({ path }) => {
    const open_ = sessions.get(key(path));
    if (!open_) return text(`card not open: ${path}`);
    sessions.delete(key(path));
    return text(`closed ${path}${open_.dirty ? " (unsaved changes discarded)" : ""}`);
  },
);

server.registerTool(
  "card_check",
  {
    description:
      "Lint a card package directory. Returns JSON {name, ok, stats, issues[]}. network=true also fetches every image URL.",
    inputSchema: {
      dir: z.string().describe("card package directory"),
      network: z.boolean().optional().describe("also check that every image URL resolves"),
    },
  },
  async ({ dir, network }) => {
    try {
      const pkg = await loadCard(dir);
      const status = await checkCard(pkg);
      if (network) status.issues.push(...(await checkImageUrls(pkg)));
      return text(
        JSON.stringify({
          name: pkg.name,
          ok: status.ok,
          stats: status.stats,
          issues: status.issues,
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_render",
  {
    description:
      "Render the card page locally (chub-shaped shell) and screenshot it at desktop 1280 and mobile 390. Uses local art when the package has it.",
    inputSchema: { dir: z.string().describe("card package directory") },
  },
  async ({ dir }) => {
    try {
      const pkg = await loadCard(dir);
      const renders = await renderCard(pkg, outDirFor(dir));
      return text(`desktop ${renders.desktop}\nmobile ${renders.mobile}`);
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_report",
  {
    description:
      "Check a card, render it, and write report.html (checks, renders, greeting image gallery).",
    inputSchema: { dir: z.string().describe("card package directory") },
  },
  async ({ dir }) => {
    try {
      const pkg = await loadCard(dir);
      const outDir = outDirFor(dir);
      const status = await checkCard(pkg);
      const renders = await renderCard(pkg, outDir);
      const path = await buildReport(pkg, status, renders, outDir);
      return text(`report ${path}`);
    } catch (error) {
      return failure(error);
    }
  },
);

function sessionInside(dir: string): CardSession | null {
  for (const item of sessions.values()) {
    if (item.file.startsWith(`${resolve(dir)}/`)) return item;
  }
  return null;
}

server.registerTool(
  "card_submit",
  {
    description:
      "Build the chub submit plan for a package: returns { script, payload } where payload comes from the open MCP session when there is one, otherwise from the package files. No files are written.",
    inputSchema: { dir: z.string().describe("card package directory") },
  },
  async ({ dir }) => {
    try {
      const pkg = await loadCard(dir);
      const base = await buildSubmitPayload(pkg);
      const open = sessionInside(dir);
      const payload = open ? buildPayloadFromCard(open.card, base) : base;
      return text(
        JSON.stringify({ source: open ? "session" : "package", script: SUBMIT_SCRIPT, payload }),
      );
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "card_edit",
  {
    description:
      "Build the chub edit plan for an already published card: returns {source, url, script, payload}. The script fills the edit form without touching visibility, rating, avatar or tags. Pass url to override the Published row in metadata.md.",
    inputSchema: {
      dir: z.string().describe("card package directory"),
      url: z.string().optional().describe("chub character URL, defaults to metadata.md Published"),
    },
  },
  async ({ dir, url }) => {
    try {
      const pkg = await loadCard(dir);
      const base = await buildSubmitPayload(pkg);
      const open = sessionInside(dir);
      const payload = open ? buildPayloadFromCard(open.card, base) : base;
      const target = url ?? editUrlFor(await publishedUrl(pkg.dir));
      if (!target) throw new Error("no Published URL in metadata.md — pass url");
      return text(
        JSON.stringify({
          source: open ? "session" : "package",
          url: target,
          script: EDIT_SCRIPT,
          payload,
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
);

/**
 * The workspace card in memory is serialised to disk only on request: large
 * fields stay out of the transcript unless inline is true.
 */
server.registerTool(
  "card_find",
  {
    description:
      "Search an open card with a regular expression and return {field, snippet} matches instead of dumping the card.",
    inputSchema: {
      path: z.string().describe("path to the card PNG"),
      pattern: z.string().describe("JavaScript regular expression"),
      flags: z.string().optional().describe("regex flags, default 'i'"),
      limit: z.number().optional().describe("max matches, default 20"),
    },
  },
  ({ path, pattern, flags, limit }) => {
    try {
      const card = session(path);
      const re = new RegExp(pattern, flags ?? "i");
      const matches: { field: string; snippet: string }[] = [];
      const walk = (node: unknown, prefix: string) => {
        if (matches.length >= (limit ?? 20)) return;
        if (typeof node === "string") {
          const index = node.search(re);
          if (index >= 0) {
            matches.push({
              field: prefix,
              snippet: node.slice(Math.max(0, index - 60), index + 120),
            });
          }
          return;
        }
        if (node && typeof node === "object") {
          for (const [key, value] of Object.entries(node))
            walk(value, prefix ? `${prefix}.${key}` : key);
        }
      };
      walk(card.card, "");
      return text(matches.length ? JSON.stringify(matches, null, 2) : "no matches");
    } catch (error) {
      return failure(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`charon card MCP server ready (${sessions.size} open)`);
