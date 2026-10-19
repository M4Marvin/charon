# Features

Charon is a self-hosted AI character chat platform. Import character cards, build lorebooks, connect any LLM provider, and have branching roleplay conversations.

## Chats

### Chat list

All your conversations in one place, grouped by recency: **Today / Yesterday / Previous 7 days / Older**. Each card shows the character avatar, chat title, last-message preview, character name when it differs from the title, and a link to the character page. Search by title or character name, rename or delete chats, or start a new one from the library.

### Chat screen

An immersive full-screen conversation view with a blurred backdrop and glassy message bubbles. The chat screen is where you spend most of your time.

**Conversing:**

- Characters greet you with their first message when you start a chat
- Type responses and the AI replies, streamed in real time
- **Swipe** between alternate AI responses — the conversation branches, and you pick the branch you like best
- **Regenerate** the latest reply to get a brand new response
- **Edit** any message you've sent and the AI will re-respond
- **Delete** a message and everything after it, pruning the conversation tree
- **Impersonate** — have the AI compose your next reply in your persona's voice, then edit and send it
- **Continue** with an empty input to prompt the AI to keep the scene going

**Chat panels:**

- **Character Portrait** — a large portrait of who you're talking to; click to open the full-screen lightbox with zoom
- **Scene** — a visual backdrop for the conversation. Pick a background from the library, upload your own custom scene image, or clear it

**Chat settings** (accessible from inside any conversation), grouped by scope:

**This chat**

- **Character** — override the description, personality, scenario, or system prompt for this conversation only; reset any field to the character card
- **Background** — pick a background from the library or upload one; the choice applies to this chat
- **Chat details** — rename the chat or permanently delete it and all its messages

**All chats**

- **Model & preset** — the default provider, model, and generation preset used by every chat; test latency and manage providers/presets
- **Your persona** — the account-wide persona: name, description, icon, and voice
- **Lorebooks** — enable world lore for all chats, expand to enable or disable individual entries, import lorebook JSON files
- **Global prompts** — the system prompt, additional instructions, and impersonation prompt used by every chat

**This browser**

- **Display** — highlight dialogue, auto-fix Markdown formatting, and block external media; saved in the browser

Providers and presets are managed from **Settings**. Chat settings changes save automatically and show a saving/saved/error status.

## Characters

### Library

Browse all characters on the server in a responsive card grid. Each card shows the character's avatar, name, tagline, creator, tags, and how many chats they've been in. Search by name or tag, sort by recency, name, or popularity. Infinite scroll loads more as you browse.

### Importing characters

Drag and drop a PNG character card (up to 50MB) to add a new character to the server. The import preview shows the character's portrait, description, tags, greetings, and a warning if a character with the same name already exists.

### Character detail

Everything you'd want to know about a character in one page:

- Portrait, name, creator, spec version, and tags
- Description (Markdown), personality, and scenario
- The character's greetings — first message plus alternate greetings you can copy
- Example messages showing the character's voice
- System prompts and post-history instructions
- An embedded lorebook if the character card includes one
- Metadata: card version, world, talkativeness, created and updated dates

From the detail page you can **Start Chat** to begin a new conversation, or pick up where you left off from your most recent chats with that character.

### Editing characters

Edit any character's card data: name, tagline, description, personality, scenario, greetings, example messages, system prompts, tags, and talkativeness. A save bar tracks unsaved changes and confirms before discarding.

## Lorebooks

Lorebooks are collections of keyword-triggered lore entries — when the conversation mentions a keyword, the relevant lore is automatically injected into the AI's context.

### Library

Browse all lorebooks on the server. Each shows its name, description, entry count, and an on/off toggle. Import lorebooks from SillyTavern world-info JSON files, or create your own from scratch.

### Lorebook detail

Open a lorebook to see all its entries. Search, filter by active/disabled status, and expand entries to preview their content. Each entry shows keyword badges, an activation order, and an on/off switch. Create or edit entries with:

- Keywords (primary and secondary) that trigger the entry
- Entry content with a live token counter
- Activation order (depth in the context insertion)
- Constant mode — always active regardless of keywords
- Disabled toggle — turn off an entry without deleting it

## AI Providers & Presets

### Providers

Connect any OpenAI-compatible endpoint — local Ollama, Anthropic, Gemini, or your own custom provider. Each provider stores its base URL and API key. Test the connection to verify latency and see available models. Set a default provider, or pick a specific model for individual chats.

### Presets

Reusable generation parameter bundles: temperature, top P, max tokens, context size, and frequency/presence penalties. Create presets for different styles (creative vs. precise, long-form vs. concise), bind them to specific providers or models, duplicate and tweak, and set a default that new chats start with.

## Settings

### Preferences

Toggles for how chats are displayed: highlight character dialogue, auto-fix Markdown formatting issues, and block external media. Changes are saved per browser.

### Profile

See your username and change your password. Changing your password signs out all other sessions.

## Cross-cutting behavior

- **Macros** — `{{char}}` and `{{user}}` are automatically substituted in your messages and prompts, so you can write generically and it adapts to whoever you're talking to.
- **Rich text** — messages support Markdown for bold, italic, code blocks, and more. Code blocks get a copy button.
- **Mobile** — the full app works on phones and tablets with responsive layouts, mobile-optimized navigation, and compact cards.
