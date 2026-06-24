import type { LoreConfig, LoreEntry } from "@/lib/st-core/lorebook";

export function makeLorebookConfig(overrides: Partial<LoreConfig> = {}): LoreConfig {
  return {
    depth: 4,
    caseSensitive: false,
    matchWholeWords: false,
    scanDepth: 10,
    ...overrides,
  };
}

export function makeLoreEntry(overrides: Partial<LoreEntry> = {}): LoreEntry {
  return {
    uid: 0,
    key: ["trigger"],
    keysecondary: [],
    comment: "A test entry",
    content: "Test content",
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
    ...overrides,
  };
}
