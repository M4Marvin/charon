import type { RegexScript, RegexParams, MacroResolver } from "./types.js";
import { SubstituteMode } from "./types.js";

/**
 * Apply all matching regex scripts to a string.
 * Scripts are filtered by placement, markdown/prompt flags, depth, and edit mode.
 */
export function getRegexedString(
  rawString: string,
  placement: number,
  scripts: RegexScript[],
  params: RegexParams = {},
  resolveMacro?: MacroResolver,
): string {
  if (typeof rawString !== "string") return "";
  if (!rawString || placement === undefined) return rawString;

  const { characterOverride, isMarkdown, isPrompt, isEdit, depth } = params;

  let result = rawString;

  for (const script of scripts) {
    if (script.disabled) continue;

    // Check placement applicability
    const promptOnly = script.promptOnly;
    const markdownOnly = script.markdownOnly;

    const appliesToMarkdown = markdownOnly && isMarkdown;
    const appliesToPrompt = promptOnly && isPrompt;
    const appliesToBoth = !markdownOnly && !promptOnly && !isMarkdown && !isPrompt;

    if (!appliesToMarkdown && !appliesToPrompt && !appliesToBoth) continue;

    // Edit filter
    if (isEdit && !script.runOnEdit) continue;

    // Depth filter
    if (typeof depth === "number") {
      if (
        !isNaN(script.minDepth) &&
        script.minDepth !== null &&
        script.minDepth >= -1 &&
        depth < script.minDepth
      )
        continue;
      if (
        !isNaN(script.maxDepth) &&
        script.maxDepth !== null &&
        script.maxDepth >= 0 &&
        depth > script.maxDepth
      )
        continue;
    }

    // Placement filter
    if (!script.placement.includes(placement)) continue;

    const scriptParams = characterOverride !== undefined ? { characterOverride } : {};
    result = runRegexScript(script, result, scriptParams, resolveMacro);
  }

  return result;
}

/**
 * Run a single regex script on a string.
 * Handles $1, $2, $<name> capture group references, {{match}} macro,
 * trim strings, and final macro substitution.
 */
export function runRegexScript(
  script: RegexScript,
  rawString: string,
  params: { characterOverride?: string } = {},
  resolveMacro?: MacroResolver,
): string {
  if (!script || script.disabled || !script.findRegex || !rawString) {
    return rawString;
  }

  // Build the find regex string, with optional macro substitution
  let regexString: string;
  switch (script.substituteRegex) {
    case SubstituteMode.None:
      regexString = script.findRegex;
      break;
    case SubstituteMode.Raw:
      regexString = resolveMacro
        ? substituteMacros(script.findRegex, resolveMacro)
        : script.findRegex;
      break;
    case SubstituteMode.Escaped:
      regexString = resolveMacro
        ? substituteMacros(script.findRegex, (name) => sanitizeRegexMacro(resolveMacro(name) ?? ""))
        : script.findRegex;
      break;
    default:
      regexString = script.findRegex;
  }

  // Compile the regex
  let findRegex: RegExp | null = null;
  try {
    const match = regexString.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
    if (match) {
      findRegex = new RegExp(match[1], match[2]);
    } else {
      findRegex = new RegExp(regexString, "g");
    }
  } catch {
    return rawString;
  }

  if (!findRegex) return rawString;

  // Apply the replacement
  const { trimStrings, replaceString } = script;
  const { characterOverride } = params;

  let newString = rawString.replace(findRegex, function (this: unknown, ...args: unknown[]) {
    // Convert {{match}} to $0
    const replaceWithGroups = replaceString.replace(/{{match}}/gi, "$0");

    // Resolve $1, $2, $<name> references
    const resolved = replaceWithGroups.replace(
      /\$(\d+)|\$<([^>]+)>/g,
      (_sub: string, num?: string, groupName?: string) => {
        let match: string | undefined;

        if (num) {
          match = args[Number(num)] as string | undefined;
        } else if (groupName) {
          const groups = args[args.length - 1] as Record<string, string> | undefined;
          match = groups?.[groupName];
        }

        if (!match) return "";

        // Apply trim strings
        const filterParams = characterOverride !== undefined ? { characterOverride } : {};
        return filterString(match, trimStrings, filterParams, resolveMacro);
      },
    );

    // Final macro substitution
    if (resolveMacro) {
      return substituteMacros(resolved, resolveMacro);
    }
    return resolved;
  });

  return newString;
}

/**
 * Remove trim strings from a matched value.
 */
export function filterString(
  rawString: string,
  trimStrings: string[],
  _params: { characterOverride?: string } = {},
  resolveMacro?: MacroResolver,
): string {
  let result = rawString;
  for (const trim of trimStrings) {
    const subTrim = resolveMacro ? substituteMacros(trim, resolveMacro) : trim;
    result = result.replaceAll(subTrim, "");
  }
  return result;
}

/**
 * Escape string for safe use inside a regex pattern.
 */
export function sanitizeRegexMacro(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  const specialChars = [
    "\n",
    "\r",
    "\t",
    "\v",
    "\f",
    "\0",
    ".",
    "^",
    "$",
    "*",
    "+",
    "?",
    "{",
    "}",
    "[",
    "]",
    "\\",
    "/",
    "|",
    "(",
    ")",
  ];
  const escMap: Record<string, string> = {
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\v": "\\v",
    "\f": "\\f",
    "\0": "\\0",
  };
  return value
    .split("")
    .map((ch) => {
      if (specialChars.includes(ch)) return escMap[ch] || "\\" + ch;
      return ch;
    })
    .join("");
}

/**
 * Substitute {{macro}} patterns in a string using a resolver function.
 */
export function substituteMacros(
  text: string,
  resolve: (name: string) => string | undefined,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    return resolve(name) ?? "";
  });
}
