export { LorePosition, SelectiveLogic, ScanState, DEFAULT_LORE_CONFIG } from './types.js';
export type { LoreEntry, LoreGlobalData, LoreConfig, LoreScanResult } from './types.js';

export { LoreBuffer, parseRegexFromString, escapeRegex } from './buffer.js';
export { buildLoreContext, formatLoreBlock } from './context-builder.js';

import {
  LoreEntry as _LoreEntry,
  LoreConfig as _LoreConfig,
  LoreGlobalData as _LoreGlobalData,
  LoreScanResult as _LoreScanResult,
} from './validators.js';

export const LoreEntrySchema = _LoreEntry;
export const LoreConfigSchema = _LoreConfig;
export const LoreGlobalDataSchema = _LoreGlobalData;
export const LoreScanResultSchema = _LoreScanResult;
