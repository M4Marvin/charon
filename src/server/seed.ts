import { randomUUID } from "node:crypto";
import { createCharacter } from "@/db/repositories/characters";
import { createAiProvider } from "@/db/repositories/aiProviders";
import { createPreset } from "@/db/repositories/presets";
import { createPersona } from "@/db/repositories/personas";
import { upsertUserSettings } from "@/db/repositories/userSettings";
import type { CharacterDataV2 } from "@/lib/st-core/character";

const SAMPLE_CHARACTER_DATA: CharacterDataV2 = {
  name: "Elena",
  description:
    "Elena is a warm and curious AI companion who loves deep conversations about art, philosophy, and technology. She is thoughtful, empathetic, and has a subtle playful wit.",
  personality:
    "Warm, curious, thoughtful, empathetic, playful, articulate. Enjoys discussing abstract ideas but also appreciates simple everyday moments.",
  scenario:
    "You meet Elena in a cozy virtual study filled with books and soft lamplight. She smiles as you enter, closing the book she was reading.",
  first_mes:
    "*Looks up with a warm smile and closes her book* Oh, hello! I was just reading about the nature of consciousness — fascinating stuff. I'm Elena. It's lovely to meet you. What brings you here today?",
  mes_example:
    "Elena: *tilts her head thoughtfully* That's an interesting perspective. I've always believed that consciousness is like a river — constantly flowing, never quite the same from one moment to the next. What do you think?",
  creator_notes:
    "Sample character for demo purposes. Warm, intellectual companion. Responds with curiosity and depth.",
  system_prompt: "",
  post_history_instructions: "",
  alternate_greetings: [
    "*Closes her laptop and turns to face you* Hey there! I was just working on some creative writing. I'm so glad you dropped by — I could use a break and some good conversation.",
    "*Leans against the bookshelf with a gentle smile* Welcome. I was hoping someone would stop by. I've been pondering some pretty big questions lately, and I'd love to hear your thoughts.",
  ],
  tags: ["sample", "demo", "conversational"],
  creator: "st-v2",
  character_version: "1.0",
  extensions: {},
};

export async function seedSampleData(userId: string): Promise<void> {
  // Sample character
  const charId = randomUUID();
  createCharacter({
    id: charId,
    userId,
    name: SAMPLE_CHARACTER_DATA.name,
    data: SAMPLE_CHARACTER_DATA,
    imagePath: null,
    tagline: "A warm and curious companion",
  });

  // Default AI provider (Ollama)
  const providerId = randomUUID();
  createAiProvider({
    id: providerId,
    userId,
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    defaultModel: "llama3.2",
    defaultHeaders: null,
  });

  // Default preset
  const presetId = randomUUID();
  createPreset({
    id: presetId,
    userId,
    name: "Creative",
    providerId,
    model: "llama3.2",
    data: {
      temperature: 0.9,
      maxTokens: 2048,
      topP: 0.95,
      contextSize: 4096,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
    },
  });

  // Default persona
  const personaId = randomUUID();
  createPersona({
    id: personaId,
    userId,
    name: "Default",
    description: "Your default persona. Customize this to describe yourself.",
    iconPath: null,
  });

  // Set defaults in user settings
  upsertUserSettings(userId, {
    defaultProviderId: providerId,
    defaultPresetId: presetId,
    defaultSelectedModel: "llama3.2",
    defaultPersonaId: personaId,
  });
}
