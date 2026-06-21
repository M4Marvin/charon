/** Where a regex script should be applied. */
export enum RegexPlacement {
  /** Before generation (on the prompt) */
  Prompt = 0,
  /** After generation (on the output) */
  Output = 1,
  /** Both */
  Both = 2,
  /** On displayed text (Markdown) */
  Display = 3,
}

/** How the find regex should be substituted before use. */
export enum SubstituteMode {
  None = 0,
  Raw = 1,
  Escaped = 2,
}

/** A regex transformation script. */
export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: RegexPlacement[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: SubstituteMode;
  minDepth: number;
  maxDepth: number;
}

/** Parameters for running a regex script. */
export interface RegexParams {
  characterOverride?: string;
  isMarkdown?: boolean;
  isPrompt?: boolean;
  isEdit?: boolean;
  depth?: number;
}

/** A macro resolver: takes a macro name and returns its value. */
export type MacroResolver = (name: string) => string | undefined;

/** Environment for macro substitution. */
export interface MacroEnv {
  user?: string;
  char?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  persona?: string;
  mesExamples?: string;
  mesExamplesRaw?: string;
  group?: string;
  charPrompt?: string;
  charJailbreak?: string;
  original?: string;
  model?: string;
  charVersion?: string;
  charDepthPrompt?: string;
  creatorNotes?: string;
  notChar?: string;
  [key: string]: unknown;
}
