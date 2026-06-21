import type { LoreEntry, LoreGlobalData, LoreConfig, ScanState } from './types.js';
import { ScanState as SS, SelectiveLogic as SL } from './types.js';

/**
 * Builds and queries a searchable text buffer from chat message history
 * for lore entry key matching. Extracted from SillyTavern's WorldInfoBuffer.
 */
export class LoreBuffer {
  static MAX_SCAN_DEPTH = 100;

  private depthBuffer: string[] = [];
  private recurseBuffer: string[] = [];
  private injectBuffer: string[] = [];
  private skew = 0;
  private startDepth = 0;
  private globalData: LoreGlobalData;

  constructor(
    messages: string[],
    globalData: LoreGlobalData,
    private config: LoreConfig,
  ) {
    this.globalData = globalData;
    this.initDepthBuffer(messages);
  }

  private initDepthBuffer(messages: string[]): void {
    for (let depth = 0; depth < LoreBuffer.MAX_SCAN_DEPTH; depth++) {
      if (messages[depth]) {
        this.depthBuffer[depth] = messages[depth].trim();
      }
      if (depth === messages.length - 1) break;
    }
  }

  private transformString(str: string, entry: LoreEntry): string {
    const caseSensitive = entry.caseSensitive ?? this.config.caseSensitive;
    return caseSensitive ? str : str.toLowerCase();
  }

  /** Build the haystack string for an entry to match against. */
  get(entry: LoreEntry, scanState: ScanState): string {
    let depth = entry.scanDepth ?? this.getDepth();
    if (depth <= this.startDepth) return '';
    if (depth < 0) return '';
    if (depth > LoreBuffer.MAX_SCAN_DEPTH) {
      depth = LoreBuffer.MAX_SCAN_DEPTH;
    }

    const MATCHER = '\x01';
    const JOINER = '\n' + MATCHER;
    let result = MATCHER + this.depthBuffer.slice(this.startDepth, depth).join(JOINER);

    if (entry.matchPersonaDescription && this.globalData.personaDescription)
      result += JOINER + this.globalData.personaDescription;
    if (entry.matchCharacterDescription && this.globalData.characterDescription)
      result += JOINER + this.globalData.characterDescription;
    if (entry.matchCharacterPersonality && this.globalData.characterPersonality)
      result += JOINER + this.globalData.characterPersonality;
    if (entry.matchCharacterDepthPrompt && this.globalData.characterDepthPrompt)
      result += JOINER + this.globalData.characterDepthPrompt;
    if (entry.matchScenario && this.globalData.scenario)
      result += JOINER + this.globalData.scenario;
    if (entry.matchCreatorNotes && this.globalData.creatorNotes)
      result += JOINER + this.globalData.creatorNotes;
    if (this.injectBuffer.length > 0) result += JOINER + this.injectBuffer.join(JOINER);
    if (this.recurseBuffer.length > 0 && scanState !== SS.MinActivations)
      result += JOINER + this.recurseBuffer.join(JOINER);

    return result;
  }

  /**
   * Check if a single needle (key) matches the haystack string.
   * Supports regex patterns (delimited by /.../), whole-word matching, and case-sensitive matching.
   */
  matchKeys(haystack: string, needle: string, entry: LoreEntry): boolean {
    const keyRegex = parseRegexFromString(needle);
    if (keyRegex) return keyRegex.test(haystack);

    haystack = this.transformString(haystack, entry);
    const transformed = this.transformString(needle, entry);
    const matchWholeWords = entry.matchWholeWords ?? this.config.matchWholeWords;

    if (matchWholeWords) {
      const keyWords = transformed.split(/\s+/);
      if (keyWords.length > 1) {
        return haystack.includes(transformed);
      }
      const regex = new RegExp(`(?:^|\\W)(${escapeRegex(transformed)})(?:$|\\W)`);
      return regex.test(haystack);
    }

    return haystack.includes(transformed);
  }

  /** Compute the match score for an entry against the current buffer state. */
  getScore(entry: LoreEntry, scanState: ScanState): number {
    const bufferState = this.get(entry, scanState);
    let primaryScore = 0;
    let secondaryScore = 0;

    if (Array.isArray(entry.key)) {
      for (const key of entry.key) {
        if (this.matchKeys(bufferState, key, entry)) primaryScore++;
      }
    }

    if (Array.isArray(entry.keysecondary) && entry.keysecondary.length > 0) {
      for (const key of entry.keysecondary) {
        if (this.matchKeys(bufferState, key, entry)) secondaryScore++;
      }

      switch (entry.selectiveLogic) {
        case SL.AND_ANY:
          return primaryScore + secondaryScore;
        case SL.AND_ALL:
          const numSecondary = entry.keysecondary.length;
          return secondaryScore === numSecondary ? primaryScore + secondaryScore : primaryScore;
        case SL.NOT_ANY:
          return secondaryScore === 0 ? primaryScore : 0;
        case SL.NOT_ALL:
          return secondaryScore < entry.keysecondary.length ? primaryScore : 0;
      }
    }

    return primaryScore;
  }

  addRecurse(message: string): void {
    this.recurseBuffer.push(message);
  }

  addInject(message: string): void {
    this.injectBuffer.push(message);
  }

  hasRecurse(): boolean {
    return this.recurseBuffer.length > 0;
  }

  advanceScan(): void {
    this.skew++;
  }

  getDepth(): number {
    return this.config.depth + this.skew;
  }
}

/** Try to parse a string as a regex (e.g., /pattern/flags). */
export function parseRegexFromString(input: string): RegExp | null {
  const match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
  if (!match) return null;
  let [, pattern, flags] = match;
  if (pattern.match(/(^|[^\\])\//)) return null;
  pattern = pattern.replace('\\/', '/');
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/** Escape regex special characters in a string. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
