# Charon

> AI character chat. Branching conversations. Your data, your API key.

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

Open http://localhost:3000. Data persists in a Docker volume.

### Option B: pnpm

```bash
pnpm install
echo 'DATABASE_URL="dev.db"' > .env
echo 'BETTER_AUTH_SECRET="your-64-char-secret"' >> .env
echo 'ENCRYPTION_KEY="your-32-char-secret"' >> .env
pnpm run dev
```

Generate secrets:

```bash
openssl rand -hex 64  # BETTER_AUTH_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
```

---

## First-time setup

1. Open http://localhost:3000 and **Sign up** — pick a username and password.
2. Go to **Settings** → **+ Add provider**, enter your API endpoint, key, and default model.
3. Go to **Characters** → **Import** and upload one or more `.png` character cards.
4. Click **+ New Chat**, pick a character, and start typing.

Characters not included. Grab some from [Chub](https://chub.ai) or copy `.png` files from a SillyTavern `public/characters/` folder.

### Chat controls

| Action | How |
|---|---|
| **Send** | Type in the composer, press Enter |
| **Swipe** (regenerate) | Click ← / → on an assistant message, or Ctrl+← / Ctrl+→ |
| **Edit** | Click the ✏️ icon, edit, click ✓ |
| **Impersonate** | Ctrl+Shift+Enter (write as your persona) |
| **Continue** | Ctrl+Enter (extend assistant's last message) |
| **Delete branch** | Trash icon on any message |

---

## Import from SillyTavern

```bash
# Copy your old data in
cp -r /path/to/SillyTavern/public/* public/data/
pnpm run migrate
```

---

## Production

```bash
pnpm run build
pnpm run start        # port 3000
```

Set `APP_URL` to your public URL for auth cookies. The production server is the same app, built once.

---

## For developers

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, project layout, architecture, and commands.
