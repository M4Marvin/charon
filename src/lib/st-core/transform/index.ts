export { RegexPlacement, SubstituteMode } from './types.js';
export type { RegexScript, RegexParams, MacroResolver, MacroEnv } from './types.js';

export {
  getRegexedString,
  runRegexScript,
  filterString,
  sanitizeRegexMacro,
  substituteMacros,
} from './regex.js';

export { evaluateMacros, buildMacroEnv } from './macros.js';

import { RegexScript as _RegexScript, RegexParams as _RegexParams } from './validators.js';

export const RegexScriptSchema = _RegexScript;
export const RegexParamsSchema = _RegexParams;
