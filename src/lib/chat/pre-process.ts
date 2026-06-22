import type { ModelMessage } from './types.js'

export function squashSystemMessages(messages: ModelMessage[]): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const msg of messages) {
    const last = out[out.length - 1]
    if (msg.role === 'system' && last?.role === 'system') {
      last.content = `${last.content}\n\n${msg.content}`
    } else {
      out.push({ ...msg })
    }
  }
  return out
}

export function applyCharacterNames(
  messages: ModelMessage[],
  behavior: 'default' | 'noNames' | 'alwaysNames',
  charName: string,
  userName: string,
): ModelMessage[] {
  return messages.map((m) => {
    if (behavior === 'noNames') {
      const { name: _name, ...rest } = m
      return rest as ModelMessage
    }
    if (behavior === 'alwaysNames') {
      let name = m.name
      if (!name && m.role === 'assistant') name = charName
      if (!name && m.role === 'user') name = userName
      return name ? { ...m, name } : m
    }
    return m
  })
}

export function applyContinuePostfix(messages: ModelMessage[], postfix: string): ModelMessage[] {
  if (!postfix || messages.length === 0) return messages
  const out = [...messages]
  const last = out[out.length - 1]
  out[out.length - 1] = { ...last, content: `${last.content}${postfix}` }
  return out
}

export function applyContinuePrefill(messages: ModelMessage[], enabled: boolean): ModelMessage[] {
  if (!enabled) return messages
  const out = [...messages]
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === 'user') {
      out[i] = { ...out[i], role: 'assistant' }
      break
    }
  }
  return out
}

export function truncateToContext(
  messages: ModelMessage[],
  contextSize: number,
  countTokens: (text: string) => number,
): { messages: ModelMessage[]; tokens: number; dropped: number } {
  const copy = [...messages]
  const totalTokens = () => copy.reduce((n, m) => n + countTokens(m.content), 0)
  let tokens = totalTokens()
  let dropped = 0
  const firstNonSystem = copy.findIndex((m) => m.role !== 'system')
  const cutIdx = firstNonSystem === -1 ? copy.length : firstNonSystem
  while (tokens > contextSize && cutIdx < copy.length - 1) {
    copy.splice(cutIdx, 1)
    dropped++
    tokens = totalTokens()
  }
  return { messages: copy, tokens, dropped }
}
