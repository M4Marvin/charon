export type {
  CharacterCard,
  CharacterCardV1,
  CharacterCardV2,
  CharacterDataV2,
  CharacterExtensions,
  DepthPrompt,
  CharacterBook,
  CharacterBookEntry,
  CharacterBookEntryExtensions,
  FlattenedCharacter,
  ValidationError,
  ValidationResult,
} from "./types.js";

export { readCharacterCard, parseCharacterCard } from "./parser.js";
export { writeCharacterCard } from "./serializer.js";
export { validateCharacterCard as validateCharacterCardLegacy } from "./validator.js";

// ArkType validators — runtime Type objects for parsing unknown data.
// Use `typeof CharacterCardSchema.infer` in place of the corresponding TS interface.
import {
  CharacterCard as _CharacterCard,
  CharacterDataV2 as _CharacterDataV2,
  CharacterBook as _CharacterBook,
  CharacterBookEntry as _CharacterBookEntry,
  DepthPrompt as _DepthPrompt,
  CharacterExtensions as _CharacterExtensions,
  CharacterCardV1 as _CharacterCardV1,
  CharacterCardV2 as _CharacterCardV2,
  FlattenedCharacter as _FlattenedCharacter,
  CharacterBookEntryExtensions as _CharacterBookEntryExtensions,
} from "./validators.js";

export const CharacterCardSchema = _CharacterCard;
export const CharacterDataV2Schema = _CharacterDataV2;
export const CharacterBookSchema = _CharacterBook;
export const CharacterBookEntrySchema = _CharacterBookEntry;
export const DepthPromptSchema = _DepthPrompt;
export const CharacterExtensionsSchema = _CharacterExtensions;
export const CharacterCardV1Schema = _CharacterCardV1;
export const CharacterCardV2Schema = _CharacterCardV2;
export const FlattenedCharacterSchema = _FlattenedCharacter;
export const CharacterBookEntryExtensionsSchema = _CharacterBookEntryExtensions;

export {
  validateCharacterCard,
  validateCharacterBook,
  validateCharacterBookEntry,
} from "./validators.js";
