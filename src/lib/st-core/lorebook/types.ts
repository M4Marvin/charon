/** Position of a lore entry's content in the prompt. */
export enum LorePosition {
  Before = 0,
  After = 1,
  ANTop = 2,
  ANBottom = 3,
  AtDepth = 4,
  EMTop = 5,
  EMBottom = 6,
  Outlet = 7,
}

/** Selective logic for secondary key matching. */
export enum SelectiveLogic {
  AND_ANY = 0,
  NOT_ALL = 1,
  NOT_ANY = 2,
  AND_ALL = 3,
}

/** Scan state for incremental scanning. */
export enum ScanState {
  None = 0,
  Initial = 1,
  Recursion = 2,
  MinActivations = 3,
}

/** Global context data used for scanning entry match conditions. */
export interface LoreGlobalData {
  personaDescription: string;
  characterDescription: string;
  characterPersonality: string;
  characterDepthPrompt: string;
  scenario: string;
  creatorNotes: string;
  trigger: string;
}

/** A single lore entry to be matched against chat context. */
export interface LoreEntry {
  uid: number;
  world?: string;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: LorePosition;
  disable: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  depth: number;
  selectiveLogic: SelectiveLogic;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  probability: number;
  useProbability: boolean;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: number;
  vectorized: boolean;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  triggers: string[];
  ignoreBudget: boolean;
  hash?: number;
  decorators?: string[];
}

/** Configuration for the lore matching engine. */
export interface LoreConfig {
  depth: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  scanDepth: number;
}

export const DEFAULT_LORE_CONFIG: LoreConfig = {
  depth: 4,
  caseSensitive: false,
  matchWholeWords: false,
  scanDepth: 10,
};

export const DEFAULT_LORE_ENTRY: Omit<LoreEntry, "uid"> = {
  key: [],
  keysecondary: [],
  comment: "",
  content: "",
  constant: false,
  selective: false,
  order: 100,
  position: 0,
  disable: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: false,
  depth: 4,
  selectiveLogic: 0,
  group: "",
  groupOverride: false,
  groupWeight: 100,
  probability: 100,
  useProbability: false,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  automationId: "",
  role: 0,
  vectorized: false,
  sticky: null,
  cooldown: null,
  delay: null,
  matchPersonaDescription: false,
  matchCharacterDescription: true,
  matchCharacterPersonality: true,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
  triggers: [],
  ignoreBudget: false,
};

/** Result of a lore scan. */
export interface LoreScanResult {
  beforeEntries: string[];
  afterEntries: string[];
  emEntries: string[];
  depthEntries: string[];
  anBeforeEntries: string[];
  anAfterEntries: string[];
  outletEntries: string[];
  allActivatedEntries: number[];
}
