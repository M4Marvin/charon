import { type } from "arktype";

export const ChatMessage = type({
  id: "number.integer",
  "parent_id?": "number.integer | null",
  children: "number.integer[]",
  "selected_child_id?": "number.integer | null",
  role: "'user' | 'assistant' | 'system'",
  "name?": "string",
  content: "string",
  "is_user?": "boolean",
  "is_system?": "boolean",
  "extra?": type({ "[string]": "unknown" }),
});

export const ChatMetadata = type({
  "active_leaf_id?": "number.integer | null",
  "[string]": "unknown",
});
