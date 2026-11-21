#!/usr/bin/env tsx
/**
 * Interactive editor for a Character Card V2/V3 embedded in a PNG.
 *
 *   pnpm card card.png
 *
 * The card is read into memory once, then every command works on that copy.
 * Nothing is written back to the image until you run `save`. For an agent
 * that needs the card to survive across separate calls, use the MCP server
 * instead: `pnpm mcp:card`.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { parseValue } from "@/lib/character/card-path.js";
import { CardSession } from "@/lib/character/card-session.js";

const HELP = `commands:
  show                      summary of the card
  get <path>                print one value        e.g. data.name
  set <path> <value>        set one value          e.g. data.alternate_greetings[0] "text"
  unset <path>              delete one key
  json                      full card JSON
  edit                      whole card in $EDITOR
  save [--out <file>] [--no-backup]
                            write the card into the PNG
  reload                    discard changes, re-read the image
  help                      this list
  quit                      leave (warns when unsaved)`;

async function editInEditor(session: CardSession): Promise<void> {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) throw new Error("set $EDITOR or $VISUAL to use edit");
  const file = join(tmpdir(), `card-${randomUUID()}.json`);
  await writeFile(file, session.json());
  const [command, ...args] = editor.split(" ");
  const run = spawnSync(command, [...args, file], { stdio: "inherit" });
  if (run.status !== 0) throw new Error(`${editor} exited with ${run.status}`);
  session.card = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  session.dirty = true;
}

function tokenize(line: string): string[] {
  const tokens = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)];
  return tokens.map((m) => m[1] ?? m[2] ?? m[3]);
}

async function runCommand(session: CardSession, line: string): Promise<boolean> {
  const [command, ...args] = tokenize(line.trim());
  if (!command) return true;

  switch (command) {
    case "help":
      console.log(HELP);
      return true;
    case "show":
      console.log(session.summary());
      return true;
    case "json":
      console.log(session.json());
      return true;
    case "get": {
      if (!args[0]) throw new Error("get needs a path");
      const value = session.get(args[0]);
      console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
      return true;
    }
    case "set": {
      if (args.length < 2) throw new Error("set needs a path and a value");
      session.set(args[0], parseValue(args.slice(1).join(" ")));
      console.log(`set ${args[0]}`);
      return true;
    }
    case "unset": {
      if (!args[0]) throw new Error("unset needs a path");
      session.unset(args[0]);
      console.log(`unset ${args[0]}`);
      return true;
    }
    case "edit": {
      await editInEditor(session);
      console.log("card replaced from editor");
      return true;
    }
    case "save": {
      const index = args.indexOf("--out");
      const out = index >= 0 ? args[index + 1] : undefined;
      console.log(`wrote ${await session.save(out, !args.includes("--no-backup"))}`);
      return true;
    }
    case "reload":
      await session.reload();
      console.log("reloaded from disk");
      return true;
    case "quit":
    case "exit":
      return false;
    default:
      throw new Error(`unknown command: ${command} (try help)`);
  }
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: card <image.png>");
    process.exit(2);
  }

  const session = await CardSession.open(file);
  console.log(session.summary());

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "card> ",
    terminal: Boolean(process.stdin.isTTY),
  });
  const interactive = Boolean(process.stdin.isTTY);
  let closed = false;
  const showPrompt = () => {
    if (interactive && !closed) rl.prompt();
  };

  showPrompt();
  for await (const line of rl) {
    try {
      if (!(await runCommand(session, line))) break;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    showPrompt();
  }
  closed = true;
  rl.close();

  if (session.dirty) {
    console.error("unsaved changes discarded — run save before quitting to keep them");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
