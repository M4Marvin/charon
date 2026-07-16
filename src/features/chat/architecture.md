# Architecture

The chat feature is split into 6 groups by concern. Each group has a clear boundary — modules in one group never import from modules in a "downstream" group, and only the appropriate group owns I/O.

## The 6 groups

```
                          ┌──────────────────────────────────┐
                          │          UI (presentation)       │
                          │  routes, components, client state│
                          └──────────────┬───────────────────┘
                                         │ hooks
                          ┌──────────────▼───────────────────┐
                          │      Generation (AI calls)       │
                          │  SSE, provider, lock lifecycle   │
                          └──────────────┬───────────────────┘
                                         │ calls
                          ┌──────────────▼───────────────────┐
                          │     Prompt (pure functions)      │
                          │  buildChatPrompt, context, scan  │
                          └──────────────────────────────────┘
                                         ▲
                          ┌──────────────┴───────────────────┐
                          │      Config (settings)            │
                          │  AI defaults, lorebook toggles,   │
                          │  persona, prompt overrides        │
                          └──────────────────────────────────┘
                                         ▲
                          ┌──────────────┴───────────────────┐
                          │          Tree (structure)         │
                          │  branching messages, active path  │
                          └──────────────┬───────────────────┘
                                         │ delegates to
                          ┌──────────────▼───────────────────┐
                          │         Data (persistence)         │
                          │  repositories, DB CRUD            │
                          └──────────────────────────────────┘
```

## What belongs where

### UI — `ui/`, `routes/`
- Route components (`/c`, `/c/new`, `/c/$id`)
- Message rendering, bubbles, markdown
- Side panels (portrait, custom image)
- Settings panel
- Client state (zustand)
- Scroll management

**Imports from:** generation (hooks), config (hooks), tree (via UI calls back to server fns)

**Does NOT:** touch the DB directly, decide message content, manage SSE

### Generation — `generation/`
- SSE endpoint (`/api/chat-generate`)
- `prepareStream` / `finalizeStream` / `cancelStream` — the streaming lifecycle
- `impersonateMessage` — non-streaming LLM call
- Provider/model/preset resolution
- Rate limiting
- Lock acquire/release
- The `@tanstack/ai-react` client integration

**Imports from:** tree (for tree operations), prompt (for prompt building), config (for user defaults)

**Does NOT:** know about UI, decide tree structure, own message content

### Prompt — `prompt/`
- `buildChatPrompt` — the production prompt builder
- Context assembly (character + history + lorebook + system prompt)
- Lorebook scanning + activation
- Pre-processing (squash, character names, continue, truncate)
- Macro substitution (`{{char}}`/`{{user}}`)
- Sentinel injection (the `"."` user message for greeting regeneration)
- Persona description injection

**Imports from:** tree (for `ChatMessage[]`), config (for prompt overrides, persona)

**Does NOT:** touch the DB, call AI providers, know about streaming

### Config — `config/`
- Provider/model/preset selection (per-user defaults)
- Lorebook activation toggles (per-user overlay)
- Persona selection (per-user active persona)
- Prompt overrides (system prompt, post-history, impersonation)
- Per-chat character field overrides

**Imports from:** data (for persistence)

**Does NOT:** know about the tree, decide message content, call AI

### Tree — `tree/` ✅ built
- Chat creation (hidden root + greetings)
- Append message to active leaf
- Append user + reply (one tree load for `getNextId` ordering)
- Swipe (navigate or create sibling)
- Delete branch
- Edit content
- Active path computation (shared server + client)

**Imports from:** data (for persistence)

**Does NOT:** know about AI, streaming, defaults, macros, personas

### Data — `data/`
- Thin wrapper over `src/db/repositories/chats.ts` (or new repository)
- DB CRUD: chats, messages

**Does NOT:** know about tree structure, AI, or anything above

## Data flow examples

### User sends a message (AI configured)

```
UI: user types in composer, hits Send
  ↓
Generation: prepareStream (mode: "send")
  → Tree: appendUserAndReply(userId, chatId, userContent, "", replyExtra: undefined)
    → Data: persist chat row + 2 messages
  ← returns { userMessage, replyMessage }
→ acquires lock on root message
  ↓
UI: reads lockMessageLocalId, shows streaming
  ↓
Generation: SSE connection → /api/chat-generate
  → reads lock from DB, gets messageId
  → Prompt: buildChatPrompt(history, character, lorebooks, settings)
  → streams from provider
  ↓
UI: onFinish → finalizeStream
  → writes content, clears lock
  ↓
Generation: prepareStream call result + lock cleared
```

### User swipes right on a user message (no AI, wants "Edit me!")

```
UI: user swipes right on user message
  ↓
Generation: caller decides content based on role
  → For user message: "Edit me!" (caller/UI provides this)
  → For assistant: empty content (or generation placeholder)
  ↓
Tree: swipe(chatId, messageLocalId, "next", { role: "user", content: "Edit me!" })
  → creates sibling, selects it
  → Data: persist sibling message
  ↓
UI: sees "Edit me!" message
  → user clicks Edit, types content, saves
  ↓
Tree: editMessage(chatId, messageLocalId, content)
  → Data: update content
  ↓
UI: user clicks Send (empty composer) → continue mode
  → Generation: prepareStream (mode: "continue") or just appendMessage with reply
```

## Boundary rules (enforced by convention)

1. **Tree never imports from prompt or generation.** Tree is the foundation.
2. **Prompt never imports from generation.** Prompt is pure. Generation calls prompt.
3. **Data is at the bottom.** Only tree and config import from data.
4. **UI is at the top.** UI imports from everything (via hooks), but the lower layers never import from UI.
5. **No cross-cutting I/O.** Each module owns its I/O. The tree service does its own DB calls. The generation module does its own DB calls. They don't share I/O.

## Why this split

Each module can be built, tested, and understood independently:
- `tree/` is testable with zero AI knowledge — pure data structures + DB CRUD
- `prompt/` is testable as pure functions — inputs in, messages out
- `generation/` is testable with mocked providers
- `config/` is testable as CRUD
- `ui/` is testable with mocked hooks

The old code had all of this tangled in `chats.ts` (server fns) and `$id.tsx` (route). Rebuilding from scratch with clean boundaries means each piece is simpler and the interactions are explicit.
