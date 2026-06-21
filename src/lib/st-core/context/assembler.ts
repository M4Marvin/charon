import type {
  PromptAssemblyConfig,
  StoryStringParams,
  AssembledPrompt,
} from './types.js';
import { InjectionPosition, SectionRole } from './types.js';
import { PromptCollection } from './collection.js';
import { renderStoryString } from './story-string.js';

/**
 * Assembles a final prompt from character data, lore, and chat history.
 * Supports both text-completion (single string) and chat-completion (message array) formats.
 */
export class PromptAssembler {
  constructor(private config: PromptAssemblyConfig) {}

  /**
   * Build a flat text prompt (for text-completion APIs).
   */
  buildTextPrompt(params: {
    storyString: string;
    storyStringParams: StoryStringParams;
    exampleMessages: string;
    chatHistory: string;
    jailbreak?: string;
    cyclePrompt?: string;
    quietPrompt?: string;
  }): AssembledPrompt {
    const storyString = renderStoryString(params.storyString, params.storyStringParams);

    const parts: string[] = [];

    if (this.config.storyStringPosition !== InjectionPosition.InChat) {
      parts.push(storyString);
    }

    if (params.exampleMessages) {
      parts.push(params.exampleMessages);
    }

    parts.push(params.chatHistory);

    if (params.cyclePrompt) {
      parts.push(params.cyclePrompt);
    }

    let text = parts.join('').replace(/\r/gm, '');

    // Add jailbreak at the end if present
    if (params.jailbreak) {
      text += `\n${params.jailbreak}`;
    }

    return {
      text,
      tokenUsage: {},
    };
  }

  /**
   * Build an ordered message array (for chat-completion APIs).
   */
  buildChatMessages(params: {
    sections: PromptCollection;
    worldInfoBefore?: string;
    worldInfoAfter?: string;
    charDescription?: string;
    charPersonality?: string;
    scenario?: string;
    personaDescription?: string;
    mainPrompt?: string;
    nsfwPrompt?: string;
    jailbreakPrompt?: string;
    exampleMessages: Array<{ role: string; content: string; name?: string }>;
    chatHistory: Array<{ role: string; content: string; name?: string }>;
    bias?: string;
    cyclePrompt?: string;
  }): AssembledPrompt {
    const messages: Array<{ role: string; content: string; name?: string }> = [];

    const addSection = (identifier: string, content?: string, role?: SectionRole) => {
      if (!content) return;
      const section = params.sections.get(identifier);
      const msg: { role: string; content: string; name?: string } = {
        role: role ?? section?.role ?? SectionRole.System,
        content,
      };
      messages.push(msg);
    };

    // Build in the standard SillyTavern order
    addSection('worldInfoBefore', params.worldInfoBefore);
    addSection('main', params.mainPrompt);
    addSection('worldInfoAfter', params.worldInfoAfter);
    addSection('charDescription', params.charDescription);
    addSection('charPersonality', params.charPersonality);
    addSection('scenario', params.scenario);
    addSection('personaDescription', params.personaDescription);
    addSection('nsfw', params.nsfwPrompt);

    // User-defined relative prompts
    const userPrompts = params.sections.collection.filter(
      (p) => !p.system_prompt && p.position !== InjectionPosition.BeforePrompt,
    );
    for (const prompt of userPrompts) {
      addSection(prompt.identifier, prompt.content, prompt.role);
    }

    addSection('bias', params.bias, SectionRole.Assistant);

    // Example messages and chat history
    if (this.config.pinExamples) {
      for (const msg of params.exampleMessages) messages.push(msg);
      for (const msg of params.chatHistory) messages.push(msg);
    } else {
      for (const msg of params.chatHistory) messages.push(msg);
      for (const msg of params.exampleMessages) messages.push(msg);
    }

    return {
      messages,
      tokenUsage: {},
    };
  }
}
