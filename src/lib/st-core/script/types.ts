// ── Argument Types ──

export enum ArgType {
  String = "string",
  Number = "number",
  Range = "range",
  Boolean = "bool",
  VariableName = "varname",
  Closure = "closure",
  Subcommand = "subcommand",
  List = "list",
  Dictionary = "dictionary",
}

export interface SlashCommandEnumValue {
  key: string;
  value: string;
  description?: string;
}

/** Definition of an unnamed argument position. */
export interface SlashCommandArgDef {
  description: string;
  typeList: ArgType[];
  isRequired: boolean;
  acceptsMultiple: boolean;
  defaultValue: string | null;
  enumList: SlashCommandEnumValue[];
  forceEnum: boolean;
}

/** Definition of a named argument. */
export interface SlashCommandNamedArgDef extends SlashCommandArgDef {
  name: string;
  aliasList: string[];
}

/** A parsed named argument: key=value. */
export interface NamedArgAssignment {
  name: string;
  value: string | ISlashCommandClosure;
}

/** A parsed unnamed argument. */
export interface UnnamedArgAssignment {
  value: string;
}

/** Definition of a slash command. */
export interface SlashCommandDef {
  name: string;
  aliases: string[];
  helpString: string;
  returns?: string;
  callback: (args: CommandArgs, value: string) => Promise<string | ISlashCommandClosure>;
  namedArgumentList: SlashCommandNamedArgDef[];
  unnamedArgumentList: SlashCommandArgDef[];
  rawQuotes: boolean;
  splitUnnamedArgument: boolean;
  splitUnnamedArgumentCount?: number;
}

/** Runtime arguments passed to a command callback. */
export interface CommandArgs {
  _scope: VariableScope;
  _abortController: AbortController;
  _hasUnnamedArgument: boolean;
  [key: string]: unknown;
}

// ── Parsing ──

export interface ParseOptions {
  verifyCommandNames?: boolean;
  flags?: Record<string, boolean>;
  abortController?: AbortController;
}

// ── Closure / Execution ──

export interface SlashCommandExecutor {
  name: string;
  command: SlashCommandDef;
  namedArgumentList: NamedArgAssignment[];
  unnamedArgumentList: UnnamedArgAssignment[];
  injectPipe: boolean;
  start: number;
  end: number;
  commandCount: number;
}

export interface ExecutionStep {
  executor: SlashCommandExecutor;
  phase: "before" | "during" | "after";
}

// ── Scope ──

export interface VariableScope {
  parent: VariableScope | null;
  variables: Record<string, string>;
  pipe: string;
}

// ── Parser flags ──

export enum ParserFlag {
  StrictEscaping = "strictEscaping",
}

// ── SlashCommandClosure (pending forward ref) ──

/**
 * A closure wraps a list of executors forming a command pipeline.
 * Defined as an interface since the full class is in runtime.ts.
 */
export interface ISlashCommandClosure {
  scope: VariableScope;
  executorList: SlashCommandExecutor[];
  executeNow: boolean;
  argumentList: NamedArgAssignment[];
  abortController?: AbortController;
  execute(): Promise<ClosureResult>;
}

export interface ClosureResult {
  pipe?: string;
  isAborted: boolean;
  isError: boolean;
  errorMessage?: string;
}
