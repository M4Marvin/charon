import { type } from "arktype";

export const SectionRole = type("'system' | 'user' | 'assistant'");

export const InjectionPosition = type("-1 | 0 | 1 | 2");

export const PromptSection = type({
  identifier: "string",
  content: "string",
  role: SectionRole,
  "position?": InjectionPosition,
  "depth?": "number",
  "order?": "number",
  "system_prompt?": "boolean",
  "extension?": "boolean",
});

export const StoryStringParams = type({
  "description?": "string",
  "personality?": "string",
  "persona?": "string",
  "scenario?": "string",
  "system?": "string",
  "char?": "string",
  "user?": "string",
  "wiBefore?": "string",
  "wiAfter?": "string",
  "loreBefore?": "string",
  "loreAfter?": "string",
  "mesExamples?": "string",
  "mesExamplesRaw?": "string",
  "anchorBefore?": "string",
  "anchorAfter?": "string",
  "[string]": "unknown",
});

export const PromptAssemblyConfig = type({
  exampleSeparator: "string",
  storyStringPosition: InjectionPosition,
  storyStringDepth: "number",
  storyStringRole: SectionRole,
  pinExamples: "boolean",
});
