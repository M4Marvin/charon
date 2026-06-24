import type { CharacterDataV2 } from "@/lib/st-core/character";

export function makeCharacterData(overrides: Partial<CharacterDataV2> = {}): CharacterDataV2 {
  return {
    name: "Test Character",
    description: "A test character",
    personality: "Cheerful",
    scenario: "A test scenario",
    first_mes: "Hello!",
    mes_example: "<START>{{user}}: hi\n{{char}}: hello",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: ["test"],
    creator: "tester",
    character_version: "1.0",
    extensions: {},
    ...overrides,
  };
}
