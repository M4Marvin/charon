import type {
  ValidationError,
  ValidationResult,
} from './types.js';

/**
 * Validate a character card against V1, V2, or V3 spec.
 * Returns the spec version number (1, 2, 3) on success, or false if no spec matches.
 */
export function validateCharacterCard(card: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  // Try V1
  const v1Result = validateV1(card);
  if (v1Result.valid) {
    return { valid: true, spec: 1, errors: [] };
  }

  // Try V2
  const v2Errors = validateV2(card);
  if (v2Errors.length === 0) {
    return { valid: true, spec: 2, errors: [] };
  }
  errors.push(...v2Errors);

  // Try V3
  const v3Errors = validateV3(card);
  if (v3Errors.length === 0) {
    return { valid: true, spec: 3, errors: [] };
  }
  errors.push(...v3Errors);

  return { valid: false, spec: false, errors };
}

const V1_REQUIRED_FIELDS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
] as const;

function validateV1(card: Record<string, unknown>): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  for (const field of V1_REQUIRED_FIELDS) {
    if (!Object.hasOwn(card, field)) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateV2(card: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (card.spec !== 'chara_card_v2') {
    errors.push({ field: 'spec', message: 'Expected "chara_card_v2"' });
  }
  if (card.spec_version !== '2.0') {
    errors.push({
      field: 'spec_version',
      message: 'Expected "2.0"',
    });
  }

  const data = card.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    errors.push({ field: 'data', message: 'Missing or invalid data object' });
    return errors;
  }

  const V2_REQUIRED_FIELDS = [
    'name',
    'description',
    'personality',
    'scenario',
    'first_mes',
    'mes_example',
    'creator_notes',
    'system_prompt',
    'post_history_instructions',
    'alternate_greetings',
    'tags',
    'creator',
    'character_version',
    'extensions',
  ] as const;

  for (const field of V2_REQUIRED_FIELDS) {
    if (!Object.hasOwn(data, field)) {
      errors.push({
        field: `data.${field}`,
        message: `Missing required field: data.${field}`,
      });
    }
  }

  if (data.alternate_greetings !== undefined && !Array.isArray(data.alternate_greetings)) {
    errors.push({
      field: 'data.alternate_greetings',
      message: 'Must be an array',
    });
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push({ field: 'data.tags', message: 'Must be an array' });
  }
  if (data.extensions !== undefined && typeof data.extensions !== 'object') {
    errors.push({
      field: 'data.extensions',
      message: 'Must be an object',
    });
  }

  // Validate character_book if present
  const book = data.character_book as Record<string, unknown> | undefined;
  if (book) {
    if (typeof book.extensions !== 'object') {
      errors.push({
        field: 'data.character_book.extensions',
        message: 'Must be an object',
      });
    }
    if (!Array.isArray(book.entries)) {
      errors.push({
        field: 'data.character_book.entries',
        message: 'Must be an array',
      });
    }
  }

  return errors;
}

function validateV3(card: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (card.spec !== 'chara_card_v3') {
    errors.push({ field: 'spec', message: 'Expected "chara_card_v3"' });
  }
  const version = Number(card.spec_version);
  if (isNaN(version) || version < 3.0 || version >= 4.0) {
    errors.push({
      field: 'spec_version',
      message: 'Expected version 3.x',
    });
  }

  const data = card.data;
  if (!data || typeof data !== 'object') {
    errors.push({ field: 'data', message: 'Missing or invalid data object' });
  }

  return errors;
}
