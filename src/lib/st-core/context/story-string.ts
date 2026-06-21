import type { StoryStringParams } from './types.js';

/**
 * Minimal template engine for the SillyTavern story string.
 * Supports:
 *   - {{varName}}           Direct substitution (HTML-unsafe)
 *   - {{#if varName}}...{{/if}}  Conditional block (truthy check)
 *   - Nested {{#if}} blocks
 *
 * Does NOT support Handlebars helpers, each, or else blocks.
 */
export function renderStoryString(template: string, params: StoryStringParams): string {
  // First pass: evaluate {{#if}} blocks
  let result = processIfBlocks(template, params);

  // Second pass: substitute remaining {{varName}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key] ?? '');
    }
    return '';
  });

  // Remove leading newlines
  result = result.replace(/^\n+/, '');

  return result;
}

function processIfBlocks(template: string, params: StoryStringParams): string {
  const IF_RE = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return template.replace(IF_RE, (_match, key: string, body: string) => {
    const value = params[key];
    if (value && typeof value === 'string' && value.trim().length > 0) {
      // Recursively process nested if-blocks
      return processIfBlocks(body, params);
    }
    return '';
  });
}

/**
 * Default story string template used by SillyTavern.
 */
export const DEFAULT_STORY_STRING_TEMPLATE = [
  '{{#if system}}{{system}}',
  '{{/if}}{{#if description}}{{description}}',
  "{{/if}}{{#if personality}}{{char}}'s personality: {{personality}}",
  '{{/if}}{{#if scenario}}Scenario: {{scenario}}',
  '{{/if}}{{#if persona}}{{persona}}',
  '{{/if}}',
].join('\n');
