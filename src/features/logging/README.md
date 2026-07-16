# Logging

Structured, level-based logger for the app. Server writes to console + daily file. Client writes to console only.

## Quick start

```typescript
import { createLogger } from "@/features/logging";

const log = createLogger("chat:tree");

log.info("Chat created", { chatId, characterId });
log.debug("Appending child", { parentId: 1, role: "user" });
log.warn("Stale lock cleared", { chatId, lockedAt: "2026-..." });
log.error("Delete failed", { chatId, messageId }, err);
```

## API

```typescript
interface Logger {
  debug(msg: string, data?: Record<string, unknown>, error?: Error): void;
  info(msg: string, data?: Record<string, unknown>, error?: Error): void;
  warn(msg: string, data?: Record<string, unknown>, error?: Error): void;
  error(msg: string, data?: Record<string, unknown>, error?: Error): void;
}

setGlobalLevel(level: LogLevel): void;
```

## Log levels

| Level   | When                                                                  | Default env |
| ------- | --------------------------------------------------------------------- | ----------- |
| `debug` | Verbose internals: tree ops, streaming tokens, lock transitions       | dev only    |
| `info`  | Normal operations: chat created, generation complete, message sent    | always on   |
| `warn`  | Recoverable issues: rate limit, stale lock cleared, content truncated | always on   |
| `error` | Failures: provider error, DB write failed, auth rejected              | always on   |

## Output

### Server (Node)

**Console** — single-line JSON per entry, pipeable to `jq`/log aggregators:

```json
{
  "level": "info",
  "ts": "2026-07-17T10:30:00.123Z",
  "module": "chat:tree",
  "msg": "Chat created",
  "data": { "chatId": "abc" }
}
```

`console.log` for `debug`/`info`, `console.warn` for `warn`, `console.error` for `error`.

**File** — same JSON, one entry per line, daily rotation:

```
logs/
├── app-2026-07-15.log
├── app-2026-07-16.log
└── app-2026-07-17.log
```

### Client (browser)

Colorized, devtools-friendly:

```
[10:30:00] INFO  chat:ui  Message rendered  {"localId":5}
```

`debug` is suppressed in production builds by default.

## Environment variables

| Variable           | Default                        | Purpose                                               |
| ------------------ | ------------------------------ | ----------------------------------------------------- |
| `LOG_LEVEL`        | `debug` in dev, `info` in prod | Minimum level: `debug` \| `info` \| `warn` \| `error` |
| `LOG_DIR`          | `./logs`                       | Directory for daily log files (server only)           |
| `LOG_FILE_ENABLED` | `true`                         | Set to `false` to disable file logging (tests, CI)    |

On the client, `localStorage.LOG_LEVEL` overrides the default for debugging production.

## Module name conventions

Use colon-delimited hierarchy:

```
chat:tree          chat:generation    chat:prompt        chat:config
chat:ui            db:repos           server:auth        server:ratelimit
```

`createLogger(name)` caches by name, so calling it twice returns the same instance.

## Runtime control

```typescript
import { setGlobalLevel } from "@/features/logging";

// Mute everything below error
setGlobalLevel("error");
```

## Error serialization

Errors passed as the third arg are destructured to `{ name, message, stack, cause }` so they appear in JSON output meaningfully:

```json
{
  "level": "error",
  "ts": "2026-07-17T...",
  "module": "chat:generation",
  "msg": "Provider call failed",
  "error": {
    "name": "FetchError",
    "message": "ECONNREFUSED",
    "stack": "FetchError: ECONNREFUSED\n  at ...",
    "cause": null
  }
}
```

## Architecture

- **`types.ts`** — `LogLevel`, `LogEntry`, `Logger`, `Transport`, `Formatter`
- **`logger.ts`** — `createLogger` factory, `setGlobalLevel`. `createLoggerCore` is the testable pure core.
- **`transports.ts`** — `createIsomorphicFn`: server returns `[console, file]`, client returns `[console]`. `node:fs`/`node:path` only loaded on the server.
- **`format.ts`** — `createIsomorphicFn`: server returns `JSON.stringify`, client returns pretty line.
- **`level.ts`** — `createIsomorphicFn`: server reads `process.env.LOG_LEVEL`, client reads `localStorage.LOG_LEVEL` or uses `import.meta.env.DEV`.

The isomorphic fns ensure `node:fs` never reaches the client bundle, and `process.env` reads happen only on the server.
