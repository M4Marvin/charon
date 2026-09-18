---
title: 'docs/markdown.md streaming section cites a nonexistent route and wrong balanceMarkdown behavior'
severity: 'minor'
---

## Expected Behavior

The "Streaming Support" section of `docs/markdown.md` should describe the real `balanceMarkdown` location, consumer, and output so it can be used as the spec for the function.

## Current Behavior

- `docs/markdown.md:210` says the function lives at `src/lib/markdown.ts:222`; it is at `:450`.
- `:221-226` and `:337-343` show the consumer as `src/routes/chats/$id.tsx` (plural, does not exist) using `message.content`. The real consumer is `src/features/chat/ui/components/chat-message.tsx` and it now uses `streamingText` / `renderContent`.
- `:218-219` claim fenced blocks are closed with a trailing newline (`\n```\n` / `\n~~~\n`); the code appends `\n` + fence with **no trailing newline**, and the unit test asserts that.

## Possible Solution

Refresh the section when touching `balanceMarkdown`: fix the path/line reference, point at `chat-message.tsx`, and correct the closing semantics.

## Minimal Reproducible Example

Open `docs/markdown.md`, compare against `src/lib/markdown.ts:450-461` and `src/features/chat/ui/components/chat-message.tsx:100-105`.

## Context

Reviewing `fix/chat-optimistic-ui`, which wires `balanceMarkdown` into streaming render. The doc was the only spec available and contradicted the code, so I could not trust it.
