/** Where a prompt section is injected. */
export enum InjectionPosition {
  None = -1,
  InPrompt = 0,
  InChat = 1,
  BeforePrompt = 2,
}

/** The role of a message in a chat completion context. */
export enum SectionRole {
  System = "system",
  User = "user",
  Assistant = "assistant",
}

/** A single section of the prompt. */
export interface PromptSection {
  identifier: string;
  content: string;
  role: SectionRole;
  position?: InjectionPosition;
  depth?: number;
  order?: number;
  system_prompt?: boolean;
  extension?: boolean;
}

/** Parameters for rendering the story string template. */
export interface StoryStringParams {
  description?: string;
  personality?: string;
  persona?: string;
  scenario?: string;
  system?: string;
  char?: string;
  user?: string;
  wiBefore?: string;
  wiAfter?: string;
  loreBefore?: string;
  loreAfter?: string;
  mesExamples?: string;
  mesExamplesRaw?: string;
  anchorBefore?: string;
  anchorAfter?: string;
  [key: string]: unknown;
}

/** Configuration for the prompt assembler. */
export interface PromptAssemblyConfig {
  exampleSeparator: string;
  storyStringPosition: InjectionPosition;
  storyStringDepth: number;
  storyStringRole: SectionRole;
  pinExamples: boolean;
}

export const DEFAULT_PROMPT_CONFIG: PromptAssemblyConfig = {
  exampleSeparator: "***",
  storyStringPosition: InjectionPosition.InPrompt,
  storyStringDepth: 1,
  storyStringRole: SectionRole.System,
  pinExamples: false,
};

/** Final assembled prompt result. */
export interface AssembledPrompt {
  /** For text-completion APIs: the final prompt string. */
  text?: string;
  /** For chat-completion APIs: ordered array of messages. */
  messages?: Array<{ role: string; content: string; name?: string }>;
  /** Token usage breakdown. */
  tokenUsage: Record<string, number>;
}
