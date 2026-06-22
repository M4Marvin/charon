import type { ChatMessage } from '@/lib/st-core/shared/types.js'

export interface ChatCompletionPreset {
  name: string
  unlockedContextSize: boolean
  contextSize: number
  maxResponseLength: number
  swipesPerGeneration: number
  streaming: boolean
  temperature: number
  frequencyPenalty: number
  presencePenalty: number
  topP: number
  seed: number
  utilityPrompts: string[]
  continuePostfix: string
  continuePrefill: boolean
  characterNamesBehavior: 'default' | 'noNames' | 'alwaysNames'
  squashSystemMessages: boolean
  enableFunctionCalling: boolean
  interleavedThinking: boolean
  sendInlineMedia: boolean
  inlineImageQuality: 'low' | 'medium' | 'high'
  requestModelReasoning: boolean
  reasoningEffort: 'auto' | 'low' | 'medium' | 'high' | 'minimum' | 'maximum'
  verbosity: 'low' | 'medium' | 'high'
  logitBias: Record<string, number>
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface SampleLoreEntry {
  uid: number
  key: string[]
  keysecondary: string[]
  content: string
  comment: string
  constant: boolean
  disable: boolean
  order: number
  position: number
  depth: number
}

export interface LoreEntryView {
  uid: number
  key: string[]
  keysecondary: string[]
  content: string
  comment: string
  constant: boolean
  order: number
  position: number
}

export interface LoreScanView {
  activated: LoreEntryView[]
  inactive: LoreEntryView[]
}

export interface PipelineStep {
  index: number
  name: string
  description: string
  messages?: ModelMessage[]
  options?: Record<string, unknown>
  finalRequest?: Record<string, unknown>
  tokenCount?: number
  diff: string
  loreScan?: LoreScanView
}

export interface PipelineInput {
  userMessage: string
  preset: ChatCompletionPreset
  character: SampleCharacter
  chatHistory: ChatMessage[]
}

export interface DepthPrompt {
  prompt: string
  depth: number
  role: 'system' | 'user' | 'assistant'
}

export interface SampleCharacter {
  name: string
  description: string
  personality: string
  scenario: string
  mesExample: string
  systemPrompt: string
  persona: string
  firstMes: string
  creatorNotes: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  depthPrompt: DepthPrompt | null
  characterBook: { name: string; entries: SampleLoreEntry[] }
}
