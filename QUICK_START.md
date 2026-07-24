# Quick Start Guide

Get Charon running and start chatting with AI characters in under 5 minutes.

## Prerequisites

- **Node.js** 22 or later
- **pnpm** (`npm install -g pnpm` if you don't have it)

## Setup

```bash
git clone https://github.com/M4Marvin/v2app.git
cd v2app
pnpm install
```

Create a `.env` file in the project root:

```
DATABASE_URL="dev.db"
BETTER_AUTH_SECRET="replace-with-a-long-random-string-at-least-64-chars"
ENCRYPTION_KEY="replace-with-another-random-string-at-least-32-chars"
```

Generate secure random strings:

```bash
openssl rand -hex 32  # for ENCRYPTION_KEY
openssl rand -hex 64  # for BETTER_AUTH_SECRET
```

## Start the app

```bash
pnpm run dev
```

Open **http://localhost:3000** in your browser.

### Docker (alternative)

```bash
docker compose up -d
```

Same URL. The SQLite database persists in a Docker volume.

## Create your account

Navigate to **/signup** (or click "Sign up" on the login page). Pick a username and password — no email required. You'll be logged in immediately.

## Configure your AI provider

Charon connects to any **OpenAI-compatible API** (OpenAI, Anthropic via proxy, OpenRouter, Ollama, local vLLM, etc.).

1. Go to **Settings** (cog icon or **/settings**)
2. Click **"+ Add provider"**
3. Fill in:
   - **Name** — any label (e.g. "OpenRouter")
   - **Base URL** — the API endpoint (e.g. `https://openrouter.ai/api/v1`)
   - **API Key** — your provider's API key (encrypted at rest in the DB)
   - **Default Model** (optional) — model ID (e.g. `openai/gpt-4o-mini`)
4. Click **Save**
5. Select the provider from the **Default provider** dropdown
6. Pick a **Default model** from the dropdown (or type a model ID)
7. Click the ⚡ icon to **test the connection** — you should see latency + model count

### Presets (optional)

Under **Settings → Presets**, create a preset to save generation parameters (temperature, max tokens, etc.) and assign it as your default.

## Add characters

Charon supports **V2 and V3 character cards** — the standard PNG format used by SillyTavern, Chub, and most character-sharing sites.

1. Go to **Characters** (navigate from the sidebar or directly to **/characters**)
2. Click **"Import"** and select one or more `.png` character cards
3. Click on any character to view their details

Need characters to test with? Download some from [Chub](https://chub.ai) or copy `.png` files from your SillyTavern `public/characters/` folder.

## Start chatting

1. From the sidebar, click **"+ New Chat"** (or go to **/c/new**)
2. Pick a character from the list
3. Type a message in the composer and press **Enter** (or click Send)

### Chat features

| Action | How |
|---|---|
| **Swipe** (regenerate) | Click the ← / → arrows on an assistant message, or press **Ctrl+← / Ctrl+→** |
| **Edit a message** | Click the ✏️ icon on any message, type your changes, click **✓** |
| **Impersonate** | Press **Ctrl+Shift+Enter** to generate a message as your character/persona |
| **Continue** | Press **Ctrl+Enter** to continue the assistant's last message |
| **Delete branch** | Click the trash icon on a message to delete it and all its replies |
| **Settings panel** | Click the cog icon in the chat header to adjust lorebooks, persona, scene, and prompts per-chat |

### Understanding the chat tree

Messages branch like a tree. When you swipe (regenerate), a new sibling message is created. You can navigate between siblings with the arrow buttons and branch off in different directions. Your conversation path is always visible and you can revisit old branches at any time.

## Import legacy SillyTavern data (optional)

If you have an existing SillyTavern installation, you can import characters, chats, and personas:

1. Copy your SillyTavern `public/` folder contents into this project's `public/data/`
2. Run the migration:
   ```bash
   pnpm run migrate
   ```

## Production build

```bash
pnpm run build
pnpm run start
```

The production server runs on port 3000. Set `PORT` in your environment to change it.

For hosting on a domain, set the `APP_URL` env var to your public URL (e.g. `https://my-server.example.com`) for correct auth cookie handling.
