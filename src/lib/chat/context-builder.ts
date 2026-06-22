import { renderStoryString } from '@/lib/st-core/context/story-string.js'
import { LorePosition } from '@/lib/st-core/lorebook/types.js'
import type { StoryStringParams } from '@/lib/st-core/context/types.js'
import type { ChatMessage } from '@/lib/st-core/shared/types.js'
import type { LoreGlobalData } from '@/lib/st-core/lorebook/types.js'
import { convertBookEntries, scanLoreEntries, toLoreEntryView } from './lorebook.js'
import { toModelMessages } from './pre-process.js'
import type { ModelMessage, SampleCharacter, ChatCompletionPreset, LoreScanView } from './types.js'

export function buildMessages(
  character: SampleCharacter,
  chatHistory: ChatMessage[],
  preset: ChatCompletionPreset,
  userName: string,
): { messages: ModelMessage[]; loreScan: LoreScanView } {
  const storyParams: StoryStringParams = {
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    system: character.systemPrompt,
    char: character.name,
    user: userName,
    mesExamples: character.mesExample,
  }
  const charDescription = renderStoryString(
    '{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}\'s personality: {{personality}}\n{{/if}}',
    storyParams,
  )

  const scenario = renderStoryString(
    '{{#if scenario}}Scenario: {{scenario}}\n{{/if}}',
    storyParams,
  )

  const exampleBlocks: string[] = character.mesExample
    .split(/<START>/gi)
    .map((b) => b.trim())
    .filter(Boolean)

  function parseExampleBlock(
    block: string,
    charName: string,
    userName: string,
  ): ModelMessage[] {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const out: ModelMessage[] = []
    let expectAssistant = true
    for (const line of lines) {
      const colon = line.indexOf(': ')
      if (colon === -1) {
        out.push({ role: expectAssistant ? 'assistant' : 'user', content: line })
        continue
      }
      const speaker = line.slice(0, colon)
      const content = line.slice(colon + 2)
      let role: 'assistant' | 'user'
      if (speaker === charName) role = 'assistant'
      else if (speaker === userName) role = 'user'
      else role = expectAssistant ? 'assistant' : 'user'
      out.push({ role, content, name: role === 'assistant' ? charName : userName })
      expectAssistant = role !== 'assistant'
    }
    return out
  }

  const globalData: LoreGlobalData = {
    personaDescription: character.persona,
    characterDescription: character.description,
    characterPersonality: character.personality,
    characterDepthPrompt: character.depthPrompt?.prompt ?? '',
    scenario: character.scenario,
    creatorNotes: character.creatorNotes,
    trigger: '',
  }
  const loreEntries = convertBookEntries(character.characterBook.entries)
  const { activated, inactive } = scanLoreEntries(loreEntries, chatHistory, globalData)
  const loreScan: LoreScanView = {
    activated: activated.map(toLoreEntryView),
    inactive: inactive.map(toLoreEntryView),
  }

  const beforeEntries = activated.filter((e) => e.position === LorePosition.Before)
  const afterEntries = activated.filter((e) => e.position === LorePosition.After)
  const atDepthEntries = activated.filter((e) => e.position === LorePosition.AtDepth)

  let historyMessages: ModelMessage[] = toModelMessages(chatHistory, character.name, userName)

  if (character.depthPrompt) {
    const insertIdx = Math.max(0, historyMessages.length - character.depthPrompt.depth)
    historyMessages = [
      ...historyMessages.slice(0, insertIdx),
      { role: character.depthPrompt.role, content: character.depthPrompt.prompt },
      ...historyMessages.slice(insertIdx),
    ]
  }

  for (const entry of atDepthEntries) {
    const insertIdx = Math.max(0, historyMessages.length - entry.depth)
    historyMessages = [
      ...historyMessages.slice(0, insertIdx),
      { role: 'system', content: entry.content },
      ...historyMessages.slice(insertIdx),
    ]
  }

  const messages: ModelMessage[] = []

  const mainPrompt = preset.utilityPrompts.join('\n\n')
  if (mainPrompt) messages.push({ role: 'system', content: mainPrompt })

  for (const entry of beforeEntries) {
    messages.push({ role: 'system', content: entry.content })
  }

  if (character.persona) {
    messages.push({ role: 'system', content: character.persona })
  }

  if (charDescription) {
    messages.push({ role: 'system', content: charDescription })
  }

  if (scenario) {
    messages.push({ role: 'system', content: scenario })
  }

  for (const entry of afterEntries) {
    messages.push({ role: 'system', content: entry.content })
  }

  for (const block of exampleBlocks) {
    messages.push({ role: 'system', content: '[Example Chat]' })
    const exampleMessages = parseExampleBlock(block, character.name, userName)
    for (const msg of exampleMessages) {
      messages.push(msg)
    }
  }

  messages.push({ role: 'system', content: '[Start a new Chat]' })

  messages.push(...historyMessages)

  if (character.postHistoryInstructions) {
    messages.push({ role: 'system', content: character.postHistoryInstructions })
  }

  return { messages, loreScan }
}
