# Logging — Usage Examples

Quick-reference for common patterns. See `README.md` for the full reference.

## Import + log

```typescript
import { createLogger } from "@/features/logging";

const log = createLogger("chat:tree");

log.debug("Appending child", { parentId: 1, role: "user" });
log.info("Chat created", { chatId, characterId });
log.warn("Stale lock cleared", { chatId, lockedAt });
log.error("Delete failed", { chatId, messageId }, err);
```

## Inside a server function

```typescript
import { createServerFn } from "@tanstack/react-start";
import { createLogger } from "@/features/logging";
import { getSession } from "@/server/session";

const log = createLogger("chat:generation");

export const prepareStream = createServerFn({ method: "POST" })
  .validator((d) => d as { chatId: string; content: string })
  .handler(async ({ data }) => {
    const { user } = await getSession();
    log.info("prepareStream start", { chatId: data.chatId, userId: user.id });

    try {
      const result = appendUserAndReply(user.id, data.chatId, data.content, "");
      log.info("prepareStream done", { assistantMessageLocalId: result.replyMessage.localId });
      return result;
    } catch (e) {
      log.error("prepareStream failed", { chatId: data.chatId }, e as Error);
      throw e;
    }
  });
```

## Inside a React component

```typescript
import { useEffect } from "react";
import { createLogger } from "@/features/logging";

const log = createLogger("chat:ui");

export function ChatMessage({ message }: { message: ChatMessage }) {
  useEffect(() => {
    log.debug("Message mounted", { localId: message.localId });
    return () => log.debug("Message unmounted", { localId: message.localId });
  }, [message.localId]);

  return <div>{message.content}</div>;
}
```

## Logging an error (preserves stack + cause)

```typescript
try {
  await provider.generate(messages);
} catch (e) {
  log.error("Provider call failed", { chatId, model }, e as Error);
  // entry.error will contain { name, message, stack, cause }
}
```

## Muting logs in dev

```typescript
import { setGlobalLevel } from "@/features/logging";

setGlobalLevel("warn"); // hide debug + info everywhere
```

## Muting via env (without code change)

```bash
LOG_LEVEL=warn bun run dev
```

## Custom module name

```typescript
const log = createLogger("db:repos");
log.info("Chat persisted", { chatId }); // → ...,"module":"db:repos",...
```

## Disable file logging (tests, CI)

```bash
LOG_FILE_ENABLED=false bun run test
```

## Skip data when none to log

```typescript
log.info("Chat created", { chatId }); // ✅ data present
log.info("Chat created"); // ✅ no data field
log.info("Chat created", undefined); // ✅ no data field
```

## Don't include the Error arg unless there is one

```typescript
log.info("Done", { chatId }); // ✅ no error field
log.error("Failed", { chatId }, err); // ✅ error field with stack
log.error("Failed", { chatId }); // ❌ don't do this — looks like a warn
```

## Output formats

**Server (JSON, one line per entry):**

```json
{
  "level": "info",
  "ts": "2026-07-17T10:30:00.123Z",
  "module": "chat:tree",
  "msg": "Chat created",
  "data": { "chatId": "abc" }
}
```

**Client (human-readable):**

```
[10:30:00] INFO  chat:ui  Message rendered  {"localId":5}
```

**Server file (`logs/app-2026-07-17.log`):** same JSON as server console.
