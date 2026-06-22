import { LoreBuffer } from '@/lib/st-core/lorebook/buffer.js'
import { buildLoreContext, formatLoreBlock } from '@/lib/st-core/lorebook/context-builder.js'
import { ScanState, DEFAULT_LORE_CONFIG } from '@/lib/st-core/lorebook/types.js'
import type { LoreEntry, LoreGlobalData, LoreConfig } from '@/lib/st-core/lorebook/types.js'
import type { ChatMessage } from '@/lib/st-core/shared/types.js'
import type { SampleLoreEntry, LoreEntryView } from './types.js'

export function convertBookEntries(entries: SampleLoreEntry[]): LoreEntry[] {
  return entries.map((e) => ({
    uid: e.uid,
    key: e.key,
    keysecondary: e.keysecondary,
    comment: e.comment,
    content: e.content,
    constant: e.constant,
    selective: e.keysecondary.length > 0,
    order: e.order,
    position: e.position,
    disable: e.disable,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    depth: e.depth,
    selectiveLogic: 0,
    group: '',
    groupOverride: false,
    groupWeight: 0,
    probability: 100,
    useProbability: true,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: 0,
    vectorized: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    triggers: [],
    ignoreBudget: false,
    sticky: null,
    cooldown: null,
    delay: null,
  }))
}

export function scanLoreEntries(
  entries: LoreEntry[],
  chatHistory: ChatMessage[],
  globalData: LoreGlobalData,
  config: LoreConfig = DEFAULT_LORE_CONFIG,
): { activated: LoreEntry[]; inactive: LoreEntry[] } {
  const messages = [...chatHistory].reverse().map((m) => m.content)
  const buffer = new LoreBuffer(messages, globalData, config)

  const activated: LoreEntry[] = []
  const inactive: LoreEntry[] = []

  for (const entry of entries) {
    if (entry.disable) continue
    if (entry.constant) {
      activated.push(entry)
      continue
    }
    const score = buffer.getScore(entry, ScanState.Initial)
    if (score > 0) {
      activated.push(entry)
    } else {
      inactive.push(entry)
    }
  }

  activated.sort((a, b) => b.order - a.order)
  inactive.sort((a, b) => b.order - a.order)

  return { activated, inactive }
}

export function toLoreEntryView(entry: LoreEntry): LoreEntryView {
  return {
    uid: entry.uid,
    key: entry.key,
    keysecondary: entry.keysecondary,
    content: entry.content,
    comment: entry.comment,
    constant: entry.constant,
    order: entry.order,
    position: entry.position,
  }
}

export function buildLoreStrings(activated: LoreEntry[]): {
  before: string | undefined
  after: string | undefined
} {
  const loreContext = buildLoreContext(activated)
  const before = formatLoreBlock(loreContext.beforeEntries) || undefined
  const after = formatLoreBlock(loreContext.afterEntries) || undefined
  return { before, after }
}
