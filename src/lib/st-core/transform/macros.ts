import type { MacroEnv, MacroResolver } from "./types.js";
import { substituteMacros } from "./regex.js";

export { substituteMacros };

/**
 * Macro definition with regex pattern and replacement function.
 */
interface MacroDef {
  regex: RegExp;
  replace: (...args: string[]) => string;
}

/**
 * Evaluate macros in content.
 * Applies macros in three phases:
 *   1. Pre-env built-ins ({{newline}}, {{trim}}, {{noop}}, etc.)
 *   2. Environment variables ({{user}}, {{char}}, {{description}}, etc.)
 *   3. Post-env built-ins ({{time}}, {{date}}, {{reverse:}}, etc.)
 */
export function evaluateMacros(
  content: string,
  env: MacroEnv,
  additionalResolve?: MacroResolver,
): string {
  if (!content) return "";

  const preEnvMacros: MacroDef[] = [
    { regex: /{{newline}}/gi, replace: () => "\n" },
    { regex: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, replace: () => "" },
    { regex: /{{noop}}/gi, replace: () => "" },
  ];

  const envMacros: MacroDef[] = [];
  for (const key of Object.keys(env)) {
    const regex = new RegExp(`{{${escapeRegex(key)}}}`, "gi");
    const replace = () => {
      const value = env[key];
      return typeof value === "function" ? (value as () => string)() : String(value ?? "");
    };
    envMacros.push({ regex, replace });
  }

  const postEnvMacros: MacroDef[] = [
    { regex: /{{time}}/gi, replace: () => new Date().toLocaleTimeString() },
    { regex: /{{date}}/gi, replace: () => new Date().toLocaleDateString() },
    {
      regex: /{{reverse:(.+?)}}/gi,
      replace: (_match: string, str: string) => Array.from(str).reverse().join(""),
    },
    { regex: /\{\{\/\/([\s\S]*?)\}\}/gm, replace: () => "" },
    {
      regex: /{{uppercase:(.+?)}}/gi,
      replace: (_match: string, str: string) => str.toUpperCase(),
    },
    {
      regex: /{{lowercase:(.+?)}}/gi,
      replace: (_match: string, str: string) => str.toLowerCase(),
    },
  ];

  const macros = [...preEnvMacros, ...envMacros, ...postEnvMacros];

  let result = content;
  for (const macro of macros) {
    if (!result) break;
    if (!result.includes("{{")) break;
    try {
      result = result.replace(macro.regex, (...args) => macro.replace(...args));
    } catch {
      // skip failed macro
    }
  }

  // Apply additional custom resolver if provided
  if (additionalResolve) {
    result = substituteMacros(result, additionalResolve);
  }

  return result;
}

/**
 * Escape regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a macro environment from a context object and character card fields.
 */
export function buildMacroEnv(overrides: Partial<MacroEnv> = {}): MacroEnv {
  return {
    user: "",
    char: "",
    description: "",
    personality: "",
    scenario: "",
    persona: "",
    mesExamples: "",
    mesExamplesRaw: "",
    group: "",
    charPrompt: "",
    charJailbreak: "",
    original: "",
    model: "",
    charVersion: "",
    charDepthPrompt: "",
    creatorNotes: "",
    notChar: "",
    ...overrides,
  };
}
