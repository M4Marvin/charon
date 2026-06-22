import { LoreBuffer } from '@/lib/st-core/lorebook/buffer.js'
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
  const messages = chatHistory.slice(-LoreBuffer.MAX_SCAN_DEPTH).reverse().map((m) => m.content)
  const buffer = new LoreBuffer(messages, globalData, config)

  const active = new Set<number>()

  for (const entry of entries) {
    if (entry.constant) {
      active.add(entry.uid)
    }
  }

  const scan = (entry: LoreEntry): boolean => {
    if (active.has(entry.uid)) return false
    if (entry.constant) return false
    return buffer.getScore(entry, ScanState.Initial) > 0
  }

  let newlyActivated: LoreEntry[] = entries.filter(scan)

  for (const entry of newlyActivated) {
    active.add(entry.uid)
  }

  while (newlyActivated.length > 0) {
    const toRecurse = newlyActivated.filter((e) => !e.preventRecursion)
    newlyActivated = []

    if (toRecurse.length > 0) {
      for (const entry of toRecurse) {
        buffer.addRecurse(entry.content)
      }
      buffer.advanceScan()

      for (const entry of entries) {
        if (entry.disable) continue
        if (entry.constant) continue
        if (active.has(entry.uid)) continue
        if (entry.excludeRecursion) continue
        if (entry.delayUntilRecursion) continue
        const score = buffer.getScore(entry, ScanState.Recursion)
        if (score > 0) {
          active.add(entry.uid)
          newlyActivated.push(entry)
        }
      }
    }
  }

  const groups = new Map<string, LoreEntry[]>()
  const ungrouped: LoreEntry[] = []

  for (const entry of entries) {
    if (!active.has(entry.uid)) continue
    if (entry.constant) {
      ungrouped.push(entry)
      continue
    }
    if (entry.group) {
      const list = groups.get(entry.group) ?? []
      list.push(entry)
      groups.set(entry.group, list)
    } else {
      ungrouped.push(entry)
    }
  }

  const sortedActivated: LoreEntry[] = [...ungrouped]
  for (const [, members] of groups) {
    members.sort((a, b) => {
      if (a.groupOverride || b.groupOverride) {
        if (a.groupWeight !== b.groupWeight) return b.groupWeight - a.groupWeight
        return b.order - a.order
      }
      if (a.order !== b.order) return b.order - a.order
      return b.groupWeight - a.groupWeight
    })
    sortedActivated.push(members[0])
  }

  sortedActivated.sort((a, b) => b.order - a.order)

  const inactive = entries.filter((e) => !active.has(e.uid))
  inactive.sort((a, b) => b.order - a.order)

  return {
    activated: sortedActivated,
    inactive,
  }
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
