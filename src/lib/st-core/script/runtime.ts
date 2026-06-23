import type { SlashCommandDef, CommandArgs } from "./types.js";
import { parse } from "./parser.js";

/**
 * Register a command in the command map.
 */
export function registerCommand(
  commands: Record<string, SlashCommandDef>,
  def: SlashCommandDef,
): void {
  commands[def.name] = def;
  for (const alias of def.aliases) {
    commands[alias] = def;
  }
}

/**
 * Parse and execute a script string synchronously (async for callbacks).
 * Returns the pipe value after execution.
 */
export async function execute(
  text: string,
  commands: Record<string, SlashCommandDef>,
  _context: Record<string, unknown> = {},
): Promise<string> {
  const closure = parse(text, commands);
  const result = await closure.execute();
  return result.pipe ?? "";
}

/**
 * Create a CommandArgs object with the given variables.
 */
export function createCommandArgs(overrides: Record<string, unknown> = {}): CommandArgs {
  return {
    _scope: { parent: null, variables: {}, pipe: "" },
    _abortController: new AbortController(),
    _hasUnnamedArgument: false,
    ...overrides,
  } as CommandArgs;
}

/**
 * Parse shorthand — split a string into individual scripts separated by newlines
 * and execute each one, accumulating pipe values.
 */
export async function executeLines(
  text: string,
  commands: Record<string, SlashCommandDef>,
  context: Record<string, unknown> = {},
): Promise<string[]> {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("/"));
  const results: string[] = [];
  for (const line of lines) {
    const result = await execute(line, commands, context);
    results.push(result);
  }
  return results;
}
