import { renderStoryString } from '@/lib/st-core/context/story-string.js'
import { parseExampleBlocks } from '@/lib/st-core/context/examples.js'
import { PromptAssembler } from '@/lib/st-core/context/assembler.js'
import { PromptCollection } from '@/lib/st-core/context/collection.js'
import { InjectionPosition, SectionRole } from '@/lib/st-core/context/types.js'
import type { StoryStringParams } from '@/lib/st-core/context/types.js'
import type { ChatMessage } from '@/lib/st-core/shared/types.js'
import type { LoreGlobalData } from '@/lib/st-core/lorebook/types.js'
import { convertBookEntries, scanLoreEntries, toLoreEntryView, buildLoreStrings } from './lorebook.js'
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
  const storyString = renderStoryString(
    '{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}\'s personality: {{personality}}\n{{/if}}{{#if scenario}}Scenario: {{scenario}}\n{{/if}}',
    storyParams,
  )

  const exampleMessages = parseExampleBlocks(character.mesExample, userName, character.name)

  const globalData: LoreGlobalData = {
    personaDescription: '',
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

  const { before: worldInfoBefore, after: worldInfoAfter } = buildLoreStrings(activated)

  const sections = new PromptCollection()
  sections.add({ identifier: 'main', content: preset.utilityPrompts.join('\n\n'), role: SectionRole.System, position: InjectionPosition.InPrompt, system_prompt: true })
  sections.add({ identifier: 'charDescription', content: storyString, role: SectionRole.System, position: InjectionPosition.InPrompt, system_prompt: true })

  let historyMessages: ModelMessage[] = chatHistory.map((m) => ({
    role: m.role,
    content: m.content,
    name: m.role === 'assistant' ? character.name : m.role === 'user' ? userName : undefined,
  }))

  if (character.depthPrompt) {
    const insertIdx = Math.max(0, historyMessages.length - character.depthPrompt.depth)
    historyMessages = [
      ...historyMessages.slice(0, insertIdx),
      { role: character.depthPrompt.role, content: character.depthPrompt.prompt },
      ...historyMessages.slice(insertIdx),
    ]
  }

  const assembler = new PromptAssembler({
    exampleSeparator: '***',
    storyStringPosition: InjectionPosition.InPrompt,
    storyStringDepth: 1,
    storyStringRole: SectionRole.System,
    pinExamples: false,
  })

  const result = assembler.buildChatMessages({
    sections,
    worldInfoBefore,
    worldInfoAfter,
    charDescription: storyString,
    exampleMessages: exampleMessages.map((e) => ({ role: e.role, content: e.content, name: e.name })),
    chatHistory: historyMessages,
    mainPrompt: preset.utilityPrompts.join('\n\n'),
  })

  let finalMessages = (result.messages ?? []) as ModelMessage[]
  if (character.postHistoryInstructions) {
    finalMessages = [...finalMessages, { role: 'system', content: character.postHistoryInstructions }]
  }

  return { messages: finalMessages, loreScan }
}
