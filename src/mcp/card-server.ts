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
import { CardSession } from "@/lib/character/card-session.js";

const sessions = new Map<string, CardSession>();

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (error: unknown) => ({
  content: [
    { type: "text" as const, text: error instanceof Error ? error.message : String(error) },
  ],
  isError: true,
});

function session(path: string): CardSession {
  const found = sessions.get(path);
  if (!found) throw new Error(`card not open: ${path} (call card_open first)`);
  return found;
}

async function open(path: string): Promise<CardSession> {
  const existing = sessions.get(path);
  if (existing) return existing;
  const created = await CardSession.open(path);
  sessions.set(path, created);
  return created;
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
    description: "Full JSON of an open card, including unsaved changes.",
    inputSchema: { path: z.string().describe("path to the card PNG") },
  },
  ({ path }) => {
    try {
      return text(session(path).json());
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
    const open_ = sessions.get(path);
    if (!open_) return text(`card not open: ${path}`);
    sessions.delete(path);
    return text(`closed ${path}${open_.dirty ? " (unsaved changes discarded)" : ""}`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`charon card MCP server ready (${sessions.size} open)`);
