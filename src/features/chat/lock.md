# Lock Design

The lock provides server-enforced temporal exclusivity for chat mutations. While a lock is held, no other mutation (swipe, edit, append, delete) can proceed. Generation is the only long-running operation that holds a lock; all other mutations are instant.

## State machine

```
                        ┌─────────┐
                        │  IDLE   │ ◄────────────────────┐
                        └────┬────┘                      │
                             │                           │
                       prepareStream                 finalizeStream
                             │                           │
                             ▼                           │
                        ┌──────────┐    cancelStream     │
                        │GENERATING├──────────────────────┤
                        └────┬─────┘                      │
                             │                           │
                             └───────────────────────────┘
                          (ensureChatIdle clears if stale)
```

## Where the lock lives

The hidden root message (localId 0) on every chat. Its `extra` field stores the lock state.

**Idle:**
```typescript
root.extra = null
// or
root.extra = undefined
```

**Generating:**
```typescript
root.extra = {
  lock: "generating",
  messageId: 5,          // which message is being streamed into
  lockedAt: 1712345678000  // unix ms, for staleness check
}
```

**Why the root message?** It's always present, never rendered, and per-chat (one root per chat). Using its `extra` field avoids a schema migration — `extra` already accepts arbitrary JSON.

## What the lock replaces

| Current scattered pattern | Replaced by |
|---|---|
| `activePlaceholderId` in zustand | `chat.lockMessageLocalId` |
| `extra: { isStreaming: true }` on placeholder | Lock state on root |
| Stale-stream recovery effect (scan messages for `isStreaming`) | Check `lockedAt` |
| `recoveredFor` gate in zustand | Gone — lock state is authoritative |
| `canSend = activePlaceholderId === null` | `chat.lockState === "idle"` |
| `disabled={activePlaceholderId !== null}` | Same — read from chat data |
| No server-side concurrency guard | Server rejects concurrent mutations |

## What gets locked

**All tree mutations are rejected when lock is held.** This includes:
- `appendMessage` (send new message)
- `appendUserAndReply` (send + reply)
- `swipe` (navigate or create sibling)
- `editMessage` (content update)
- `deleteBranch` (subtree removal)

The generation module is also indirectly guarded — `prepareStream` calls `acquireGenerationLock`, which calls `ensureChatIdle` first, so starting a new generation while one is active also throws.

**Read operations are always allowed:**
- `getChat`
- `getMessages`
- `getActivePath`
- `getPathToMessage`

## Stale recovery

If the server crashes during generation, `finalizeStream` never runs and the lock stays. A lock is considered **stale** when `Date.now() - lockedAt > STALE_LOCK_MS` (suggested: 5 minutes).

**Recovery strategy: self-healing on any mutation attempt.**

Every mutation checks the lock. If the lock is stale, it is cleared immediately (no separate recovery endpoint needed):

```typescript
function ensureChatIdle(userId: string, chatId: string, db: DB): void {
  const root = repoGetMessage(userId, chatId, 0, db);
  if (!root?.extra) return; // no extra = idle
  if (root.extra.lock !== "generating") return; // not a lock

  const age = Date.now() - (root.extra.lockedAt as number);
  if (age <= STALE_LOCK_MS) {
    throw new Error("Chat is busy: generation in progress");
  }

  // Stale lock — clear it. Preserve the placeholder's content if any
  // (the stream may have completed but finalizeStream failed).
  repoUpdateMessage(userId, chatId, 0, { extra: null }, db);
}
```

**No subtree deletion on recovery.** If the stream completed but `finalizeStream` failed, the placeholder has content — preserve it. The user sees a normal message and can edit or delete it. If the stream didn't start, the placeholder is empty — user can delete it.

## API

### Types

```typescript
export interface ChatLockState {
  lock: "generating";
  messageId: number;
  lockedAt: number; // unix ms
}

export const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes
```

### Functions (implemented in `tree/lock.ts`)

```typescript
// Check lock state. Throws if locked and not stale.
// Clears stale locks automatically (self-healing).
function ensureChatIdle(userId: string, chatId: string, db: DB = defaultDb): void

// Acquire generation lock. Sets root.extra to lock state.
// Throws if chat is already locked (and not stale — clears first).
function acquireGenerationLock(
  userId: string, chatId: string, messageLocalId: number, db: DB = defaultDb
): void

// Release lock. Sets root.extra to null.
// No-op if not locked.
function releaseLock(userId: string, chatId: string, db: DB = defaultDb): void
```

### `ChatDetail` additions

```typescript
export interface ChatDetail {
  // ... existing fields ...
  lockState: "idle" | "generating";
  lockMessageLocalId: number | null;
}
```

`getChat` reads the root message to populate these. One extra DB read (indexed by composite PK `chatId + localId`).

## Data flow

### Normal generation lifecycle

```
1. UI: user hits Send
2. Generation: prepareStream
   → Tree: appendUserAndReply (user msg + empty reply)
   → Lock: acquireGenerationLock(messageId = reply.localId)
   ← returns { assistantMessageLocalId: reply.localId }
3. UI: sets up SSE connection
4. SSE endpoint: reads lock from DB, gets messageId
   → Prompt: buildChatPrompt
   → streams from provider
5. UI: onFinish → Generation: finalizeStream
   → Tree: editMessage(messageId, content)
   → Lock: releaseLock
6. UI: refetches messages
```

### Server crash during generation

```
1-4. Same as above
5. Server crashes (network failure, server restart, client disconnect)
6. finalizeStream never runs
7. Lock stays on root.extra
8. User refreshes the page
9. UI calls getChat → reads lockState = "generating", lockMessageLocalId = X
10. UI shows "Generation in progress" badge
11. User tries to send a new message
12. Tree service: ensureChatIdle → lock is stale (>5 min) → clears it
13. Mutation proceeds normally
```

### Concurrent mutation attempt

```
1. Chat is idle
2. User A starts a generation → lock acquired
3. User A's second tab (or another user) tries to swipe
4. Tree service: ensureChatIdle → lock is active → throws
5. UI: sees error, shows "Chat is busy" message
```

## Integration with generation module (future)

The generation module is the only consumer of `acquireGenerationLock` and `releaseLock`. All other callers (UI, config) just read the lock state from `chat.lockState`.

```typescript
// generation/fns.ts (future):

export const prepareStream = createServerFn({ method: "POST" })
  .validator(...)
  .handler(async ({ data }) => {
    const { user } = await getSession();
    const { userMessage, replyMessage } = appendUserAndReply(
      user.id, data.chatId, data.content, "", undefined, db
    );
    acquireGenerationLock(user.id, data.chatId, replyMessage.localId, db);
    return { assistantMessageLocalId: replyMessage.localId };
  });

export const finalizeStream = createServerFn({ method: "POST" })
  .validator(...)
  .handler(async ({ data }) => {
    const { user } = await getSession();
    editMessage(user.id, data.chatId, data.messageLocalId, data.content, db);
    releaseLock(user.id, data.chatId, db);
    return { ok: true };
  });

export const cancelStream = createServerFn({ method: "POST" })
  .validator(...)
  .handler(async ({ data }) => {
    const { user } = await getSession();
    // Verify lock exists and is for this message
    // Delete the placeholder subtree
    deleteBranch(user.id, data.chatId, data.messageLocalId, db);
    releaseLock(user.id, data.chatId, db);
    return { ok: true };
  });
```

## Race conditions

With better-sqlite3 (synchronous), there's no `await` between the lock check and the mutation. The entire flow is:

```typescript
ensureChatIdle(user, chatId, db);  // sync — check + maybe clear
const newNode = appendChild(tree, parentId, msg);  // sync — pure tree op
persistParent(user, chatId, tree, parentId, db);  // sync — write
persistNewMessage(user, chatId, newNode, db);  // sync — write
```

This is atomic from the service's perspective. No other code can run between check and write. Even if two HTTP requests arrive simultaneously in Node.js, better-sqlite3 serializes all writes.

## Why not a separate `chat_locks` table?

A separate table is cleaner architecturally (separation of concerns) but requires a migration. Using the root message's `extra` field is pragmatic:
- Zero schema changes
- Always present (one root per chat)
- Never rendered (can be used for metadata)
- Per-chat naturally
- Can be cleared with the same `repoUpdateMessage` used for regular edits

If a future use case needs to query lock state across chats (e.g., "show all active generations"), a separate table would be better. Until then, the root message is fine.
