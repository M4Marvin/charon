import { type } from "arktype";

export const ChatMessage = type({
  localId: "number.integer",
  "parentLocalId?": "number.integer | null",
  children: "number.integer[]",
  "selectedChildLocalId?": "number.integer | null",
  role: "'user' | 'assistant' | 'system'",
  "name?": "string",
  content: "string",
  "isUser?": "boolean",
  "isSystem?": "boolean",
  "extra?": type({ "[string]": "unknown" }),
});

export const ChatMetadata = type({
  "active_leaf_id?": "number.integer | null",
  "[string]": "unknown",
});
