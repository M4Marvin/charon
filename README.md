# Charon

> My take on properly building an app that combines features from Chub, SillyTavern, and everything else I always wanted.

Charon is a self-hosted web app for roleplaying with AI characters. Import character cards from SillyTavern or Chub, chat with branching message trees, swipe between replies, and keep everything local.

---

## Features

- **Branching conversations** — every swipe creates a new branch. Navigate freely, edit inline, never lose a reply.
- **Character cards V2 + V3** — import `.png` cards from SillyTavern, Chub, or anywhere. No conversion needed.
- **Your own API key** — BYO OpenAI-compatible provider (OpenAI, Anthropic via proxy, OpenRouter, Ollama, vLLM, etc.). Keys encrypted at rest.
- **Lorebooks** — attach background lore to a chat. The AI reads relevant entries automatically.
- **Personas** — define multiple personas and switch per chat.
- **Markdown rendering** — bold, italic, code blocks, images, `<style>` scoping, dialogue highlighting. Streaming-safe with fade-in.
- **Self-hosted** — your data stays in a local SQLite file. No cloud, no telemetry, no accounts except yours.

---

## Quick start

### Option A: Docker (recommended)

```bash
docker compose up -d
```

Open http://localhost:3000. Data persists in a Docker volume (`charon-data`).
Set `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` in your environment (or a `.env`
file next to `docker-compose.yml`) — see below for generating them.

### Option B: pnpm

```bash
pnpm install
echo 'DATABASE_URL="dev.db"' > .env
echo 'BETTER_AUTH_SECRET="your-64-char-secret"' >> .env
echo 'ENCRYPTION_KEY="your-32-char-secret"' >> .env
pnpm run dev
```

Don't have pnpm? `npm install -g pnpm` or see [pnpm.io](https://pnpm.io/installation).

Generate secrets:

```bash
openssl rand -hex 64  # BETTER_AUTH_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
```

Migrations run automatically on first start — no manual `db:migrate` needed.

Upgrading an existing database from an older version? The first boot after the single-user update migrates it to a single admin account (removing other accounts). To do that deliberately and reversibly, stop the app and run `pnpm migrate:single-user` first — it copies the database (and its `-wal`/`-shm` sidecars, if any) to `dev.db.bak-single-user-<timestamp>` before migrating. If anything goes wrong, restore it with `cp dev.db.bak-single-user-<timestamp> dev.db` (using the exact `<timestamp>` the backup printed, plus the matching `-wal`/`-shm` backups if present) and start again.

---

## First-time setup

1. Open http://localhost:3000 and **Create your account** — pick a username and password.
2. You'll land in the guided **onboarding wizard**, which takes you through the
   rest: connect an AI provider, and get a character.
3. Click **Start chatting** and you're in — pick a character and type.

Characters not included. Grab some from [Chub](https://chub.ai) or copy `.png` files from a SillyTavern `public/characters/` folder.

### Chat controls

| Action                            | How                                                                         |
| --------------------------------- | --------------------------------------------------------------------------- |
| **Send**                          | Type in the composer, press Enter (Enter also stops while the AI is typing) |
| **New line**                      | Shift+Enter                                                                 |
| **Swipe** (see alternate replies) | Click the ← / → buttons under an AI message                                 |
| **Regenerate**                    | Click the circular-arrow button on the last AI message                      |
| **Edit**                          | Click the ✏️ icon, edit, click ✓ (or Ctrl/Cmd+Enter; Esc cancels)           |
| **Impersonate**                   | Click the wand icon in the composer, review the draft, press Enter          |
| **Continue**                      | Leave the input empty and press Enter                                       |
| **Delete branch**                 | Trash icon on any message                                                   |
| **Command menu**                  | Ctrl+K                                                                      |

---

## Import from SillyTavern

```bash
# Copy your old data into private migration storage
cp -r /path/to/SillyTavern/public/* data/import/

# Import into the database and private data/uploads/ storage
pnpm run migrate

# For installs with data still under the old public/data path
pnpm run prepare:migration

# For installs that already ran the old migration, move legacy public/data images
pnpm run migrate:image-paths
```

---

## Production

```bash
pnpm run build
pnpm run start         # port 3000
```

Set `APP_URL` to your public URL for auth cookies. The production server is the same app, built once.

---

## For developers

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, project layout, architecture, and commands.
