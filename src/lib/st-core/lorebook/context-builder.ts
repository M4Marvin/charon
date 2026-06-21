import type { LoreEntry, LoreScanResult } from './types.js';
import { LorePosition } from './types.js';

const ENTRY_SEPARATOR = '\n';

/**
 * Build lore content blocks organized by position.
 * @param entries Activated entries sorted by insertion order.
 * @returns Organized blocks for each position.
 */
export function buildLoreContext(entries: LoreEntry[]): LoreScanResult {
  const result: LoreScanResult = {
    beforeEntries: [],
    afterEntries: [],
    emEntries: [],
    depthEntries: [],
    anBeforeEntries: [],
    anAfterEntries: [],
    outletEntries: [],
    allActivatedEntries: [],
  };

  for (const entry of entries) {
    result.allActivatedEntries.push(entry.uid);
    const content = entry.content;

    switch (entry.position) {
      case LorePosition.Before:
        result.beforeEntries.push(content);
        break;
      case LorePosition.After:
        result.afterEntries.push(content);
        break;
      case LorePosition.ANTop:
        result.anBeforeEntries.push(content);
        break;
      case LorePosition.ANBottom:
        result.anAfterEntries.push(content);
        break;
      case LorePosition.AtDepth:
        result.depthEntries.push(content);
        break;
      case LorePosition.EMTop:
      case LorePosition.EMBottom:
        result.emEntries.push(content);
        break;
      case LorePosition.Outlet:
        result.outletEntries.push(content);
        break;
    }
  }

  return result;
}

/**
 * Format a list of entry contents into a single string block.
 */
export function formatLoreBlock(entries: string[], header?: string): string {
  if (entries.length === 0) return '';
  const joined = entries.join(ENTRY_SEPARATOR);
  return header ? `${header}\n${joined}` : joined;
}
