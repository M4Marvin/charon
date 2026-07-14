export type {
  CharacterAsset,
  CharacterCard,
  CharacterCardV1,
  CharacterCardV2,
  CharacterCardV3,
  CharacterDataV2,
  CharacterDataV3,
  CharacterExtensions,
  DepthPrompt,
  CharacterBook,
  CharacterBookEntry,
  CharacterBookEntryExtensions,
  FlattenedCharacter,
  ValidationError,
  ValidationResult,
} from "./types.js";
export type { CharacterCardSpec } from "./parser.js";

export { getCharacterCardSpec, parseCharacterCard, readCharacterCard } from "./parser.js";
export { writeCharacterCard } from "./serializer.js";
export { validateCharacterCard as validateCharacterCardLegacy } from "./validator.js";

// ArkType validators — runtime Type objects for parsing unknown data.
// Use `typeof CharacterCardSchema.infer` in place of the corresponding TS interface.
import {
  CharacterAsset as _CharacterAsset,
  CharacterCard as _CharacterCard,
  CharacterDataV2 as _CharacterDataV2,
  CharacterDataV3 as _CharacterDataV3,
  CharacterCardV3 as _CharacterCardV3,
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
export const CharacterDataV3Schema = _CharacterDataV3;
export const CharacterCardV3Schema = _CharacterCardV3;
export const CharacterAssetSchema = _CharacterAsset;
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
  validateCharacterCardV3,
  validateCharacterBook,
  validateCharacterBookEntry,
} from "./validators.js";
