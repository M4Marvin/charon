# Tree Module

Pure data structure operations on the branching message tree. No AI awareness, no defaults, no macros, no streaming. The tree is content-agnostic — all message content comes from the caller.

## API

### `operations.ts` — pure (no I/O)

```typescript
// Append a child to a specific parent. Returns the new node.
appendChild(tree: ChatTree, parentId: number, msg: NewMessage): ChatMessage

// Append to the active leaf (follows selectedChildLocalId chain from root).
appendToActiveLeaf(tree: ChatTree, msg: NewMessage): ChatMessage

// Select an existing sibling. Returns the selected node or null if no sibling in direction.
selectSibling(tree: ChatTree, messageLocalId: number, direction: "next" | "prev"): ChatMessage | null

// Create a new sibling and select it. Caller provides content.
createSiblingAndSelect(tree: ChatTree, targetId: number, msg: SiblingContent): ChatMessage

// Delete a subtree. Returns the deleted localIds.
removeBranch(tree: ChatTree, messageLocalId: number): number[]

// Edit content only. No tree structure change.
editContent(tree: ChatTree, messageLocalId: number, content: string): void
```

All operations reject `localId === 0` (hidden root).

### `active-path.ts` — pure (no I/O)

```typescript
// Build tree from messages, return active path with sibling metadata.
// Filters out system root.
computeActivePathFromMessages(messages: ChatMessage[]): ActivePathEntry[]

// Compute active path from an already-built tree.
computeActivePath(tree: ChatTree): ActivePathEntry[]

// Walk from a specific node back to root. Used by generation to build prompt context.
getPathToNode(tree: ChatTree, nodeId: number): ChatMessage[]
```

### `service.ts` — I/O via repository

```typescript
// ── Reads ──
listChats(userId: string, db?: DB): ChatWithCharacter[]
getChat(userId: string, chatId: string, db?: DB): ChatDetail
getMessages(userId: string, chatId: string, db?: DB): ChatMessage[]
getActivePath(userId: string, chatId: string, db?: DB): ActivePathEntry[]
getPathToMessage(userId: string, chatId: string, messageLocalId: number, db?: DB): ChatMessage[]

// ── Chat lifecycle ──
createChat(userId: string, input: CreateChatInput, db?: DB): ChatDetail
deleteChat(userId: string, chatId: string, db?: DB): void

// ── Message operations ──
appendMessage(userId: string, chatId: string, msg: NewMessage, db?: DB): ChatMessage
appendUserAndReply(userId: string, chatId: string, userContent: string, replyContent: string, replyExtra?: Record<string, unknown>, db?: DB): { userMessage, replyMessage }
swipe(userId: string, chatId: string, messageLocalId: number, direction: "next" | "prev", createIfMissing?: SiblingContent, db?: DB): SwipeResult
deleteBranch(userId: string, chatId: string, messageLocalId: number, db?: DB): { deletedIds: number[] }
editMessage(userId: string, chatId: string, messageLocalId: number, content: string, db?: DB): void
```

## Types

```typescript
import type { ChatMessage } from "@/lib/st-core/shared/types";

export type { ChatMessage };

export interface NewMessage {
  role: "user" | "assistant";
  content: string;
  extra?: Record<string, unknown>;
}

export interface SiblingContent {
  role: "user" | "assistant";
  content: string;
  extra?: Record<string, unknown>;
}

export interface ActivePathEntry {
  message: ChatMessage;
  siblingIndex: number;
  siblingTotal: number;
  // No isStreaming — the UI derives this from the lock.
  // No isDraft — drafts don't exist (use inline edit instead).
}

export interface CreateChatInput {
  characterId: string;
  title: string;
  greetings: string[]; // caller provides already-substituted text
  characterDescription?: string;
  characterPersonality?: string;
  characterScenario?: string;
  characterSystemPrompt?: string;
}

export interface SwipeResult {
  selectedMessage: ChatMessage;
  created: boolean; // true if a new sibling was created
}

export interface ChatDetail {
  id: string;
  characterId: string;
  title: string;
  characterDescription: string;
  characterPersonality: string;
  characterScenario: string;
  characterSystemPrompt: string;
  backgroundId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lockState: "idle" | "generating";
  lockMessageLocalId: number | null;
}
```

## Key conventions

### All content from caller

The tree never decides what a message says. The caller provides:

- Greeting texts for `createChat` (already macro-substituted)
- Reply content for `appendUserAndReply` (could be AI output, default text, or empty for streaming)
- Content for new siblings in `swipe` (caller decides based on role — "Edit me!" for user, "Make your own greeting!" for greetings, placeholder for regeneration)
- New content for `editMessage` (user input)

### `getNextId` ordering rule

When appending multiple nodes in one tree load, call `addChild` (or `appendChild`) for the first node BEFORE allocating the second node's id. Otherwise both `getNextId` calls return the same id and the second `addChild` throws "node already exists."

`appendUserAndReply` handles this correctly:

```typescript
const userMessage = appendChild(tree, activeLeafId, { role: "user", content: userContent });
// Now userMessage is in the tree, getNextId will return a fresh id
const replyMessage = appendChild(tree, userMessage.localId, {
  role: "assistant",
  content: replyContent,
});
```

### Hidden root (localId 0)

Every chat has a hidden system root at `localId 0`:

- `role: "system"`, `content: ""`
- `children: [1, 2, ...]` (greeting ids)
- `selectedChildLocalId: 1` (first greeting is default)
- Never rendered (UI filters `role === "system"`)
- Never mutated by external callers (all operations reject `localId 0`)

### Drafts: don't exist

There is no `isDraft` flag. The swipe-right flow on a user message creates a normal user message with content "Edit me!" (provided by the caller). The user edits it using the existing edit flow — no special state.

### Streaming: not tracked per-message

There is no `isStreaming` flag on messages. The lock (chat-level) tracks which message is being streamed into. See `lock.md`.

## What was rejected (and why)

| Rejected                                   | Why                                                                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isDraft` flag on user messages            | The draft was a UX hack — user types in composer, content gets injected into the draft. Unified editing: both new content and fixes use the same inline edit flow. Swipe creates a placeholder with "Edit me!" text. |
| `isStreaming` flag on placeholder          | The lock is the single source of truth. `chat.lockMessageLocalId` tells the UI which message is streaming. No need to smear chat-level state onto every message.                                                     |
| `populateDraft` / `isDraftNode` operations | Drafts don't exist.                                                                                                                                                                                                  |
| `DEFAULT_REPLIES` fallback                 | The tree never decides content. Caller provides it.                                                                                                                                                                  |
| Macro substitution at persistence          | The tree is content-agnostic. Caller substitutes macros before calling.                                                                                                                                              |
| `rows.ts` separate file                    | The null/undefined conversion is trivial. Inlined as private functions in `service.ts`.                                                                                                                              |
| `ChatMessageRow` in the public API         | `service.ts` returns `ChatMessage[]` to the client. The client never sees row types.                                                                                                                                 |

## Test coverage

| File                  | Tests | Covers                                                                                                                                          |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `active-path.test.ts` | 9     | Path computation, filtering, sibling metadata, `getPathToNode`                                                                                  |
| `operations.test.ts`  | 22    | All pure operations, root guards, edge cases                                                                                                    |
| `service.test.ts`     | 28    | Full DB integration: create, read, append, swipe, delete, edit, appendSibling, skipIdleCheck branch                                       |
| `lock.test.ts`        | 16    | Lock state on `ChatDetail`, `ensureChatIdle`, `acquireGenerationLock` / `releaseLock` lifecycle, mutation rejection when locked, stale recovery |

## How callers use this module

### Generation module (future)

```typescript
// prepareStream (send mode):
const { userMessage, replyMessage } = appendUserAndReply(
  userId,
  chatId,
  userContent,
  "",
  undefined,
  db,
);
acquireGenerationLock(userId, chatId, replyMessage.localId, db);

// finalStream:
editMessage(userId, chatId, lockMessageLocalId, content, db);
releaseLock(userId, chatId, db);

// prepareStream (regenerate mode):
const { selectedMessage, created } = swipe(
  userId,
  chatId,
  targetLocalId,
  "next",
  { role: "assistant", content: "" },
  db,
);
acquireGenerationLock(userId, chatId, selectedMessage.localId, db);
```

### UI module (future)

```typescript
// Swipe right on user message:
const result = swipe(userId, chatId, messageLocalId, "next", {
  role: "user",
  content: "Edit me!"
}, db);

// Edit message inline:
editMessage(userId, chatId, messageLocalId, newContent, db);

// Send new message:
appendUserAndReply(userId, chatId, composerInput, aiReplyContent, undefined, db);

// Render active path:
const path = getActivePath(userId, chatId, db);
path.map(entry => <Message entry={entry} isStreaming={entry.message.localId === chat.lockMessageLocalId} />);
```

## Dependencies

- `src/lib/st-core/chat-tree/` — pure tree primitives (`addChild`, `addSibling`, `deleteSubtree`, `getNextId`, `getNode`, `getActivePath`, `getSiblings`, `getNextSiblingId`, `getPrevSiblingId`, `treeFromNodes`)
- `src/db/repositories/chats.ts` — DB CRUD with ownership enforcement
- `src/db/schema.ts` — `ChatMessageRow`, `NewChatMessageRow` types

## TODO (when lock module is built)

- ✅ Add `lockState: "idle" | "generating"` and `lockMessageLocalId: number | null` to `ChatDetail`
- ✅ Update `getChat` to read the root message for lock state
- ✅ Add `ensureChatIdle` check to all mutation functions
- ✅ Add `acquireGenerationLock` / `releaseLock` functions

See `lock.md` for the full lock design. Implementation lives in `tree/lock.ts`.
