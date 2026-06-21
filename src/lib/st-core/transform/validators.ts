import { type } from 'arktype';

export const RegexPlacement = type('0 | 1 | 2 | 3');

export const SubstituteMode = type('0 | 1 | 2');

export const RegexScript = type({
  id: 'string',
  scriptName: 'string',
  findRegex: 'string',
  replaceString: 'string',
  trimStrings: 'string[]',
  placement: RegexPlacement.array(),
  disabled: 'boolean',
  markdownOnly: 'boolean',
  promptOnly: 'boolean',
  runOnEdit: 'boolean',
  substituteRegex: SubstituteMode,
  minDepth: 'number',
  maxDepth: 'number',
});

export const RegexParams = type({
  'characterOverride?': 'string',
  'isMarkdown?': 'boolean',
  'isPrompt?': 'boolean',
  'isEdit?': 'boolean',
  'depth?': 'number',
});
