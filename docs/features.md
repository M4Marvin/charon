# Features

Charon is a self-hosted AI character chat platform. Import character cards, build lorebooks, connect any LLM provider, and have branching roleplay conversations.

## Two tiers

### Admin

The person who runs the server. An admin can:

- Import, edit, and delete characters
- Manage AI providers, presets, and generation parameters
- Create, edit, and delete lorebooks
- Upload and manage background scenes
- Manage user accounts — invite new users, promote/demote admins, ban/unban
- Configure a shared AI provider that all demo users talk through

Admins also get the full chat experience, plus a settings panel in every chat to switch providers, pick models, adjust presets, and tweak character overrides.

### Demo users

Casual chatters invited to the server. They can:

- Start conversations with any public character
- Browse the full character library and lorebook library
- Use all the chat features — branching, swiping, regenerating, impersonation
- Create and manage their own personas
- Upload custom chat scenes

They cannot import, edit, or delete characters, providers, presets, lorebooks, or other users. Chats use the shared AI provider configured by the admin. A daily generation limit applies.

## Chats

### Chat list

All your conversations in one place, grouped by recency: **Today / Yesterday / Previous 7 days / Older**. Each card shows the character avatar, chat title, character name, and a link to the character page. Search by title or character name, rename or delete chats, or start a new one from the library.

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

**Chat settings** (accessible from inside any conversation):
- **Connection** (admin) — switch AI providers, test latency, pick a model, or choose a generation preset
- **Persona** — who you are in the conversation. Create multiple personas with a name, description, and icon; switch between them on the fly
- **Lorebooks** — toggle world lore on and off per chat, expand to enable or disable individual lore entries, import lorebook JSON files
- **Prompts** — customize your system prompt, post-history instructions, and impersonation prompt. Changes are saved and specific to this chat
- **Character overrides** — tweak the character's description, personality, scenario, or system prompt just for this conversation without changing the original card
- **Scene** — pick a background from the library
- **Display** — highlight dialogue, auto-fix Markdown formatting, block external media
- **Delete chat** — permanently remove the conversation and all its messages

## Characters

### Library

Browse all characters on the server in a responsive card grid. Each card shows the character's avatar, name, tagline, creator, tags, and how many chats they've been in. Search by name or tag, sort by recency, name, or popularity. Infinite scroll loads more as you browse.

### Importing characters (admin)

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

### Editing characters (admin)

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

## AI Providers & Presets (admin)

### Providers

Connect any OpenAI-compatible endpoint — local Ollama, Anthropic, Gemini, or your own custom provider. Each provider stores its base URL and API key. Test the connection to verify latency and see available models. Set a default provider, or pick a specific model for individual chats.

### Demo provider

Set up one shared AI provider that all demo users on the server talk through. No per-user configuration needed — demo users just start chatting. Changes take effect immediately.

### Presets

Reusable generation parameter bundles: temperature, top P, max tokens, context size, and frequency/presence penalties. Create presets for different styles (creative vs. precise, long-form vs. concise), bind them to specific providers or models, duplicate and tweak, and set a default that new chats start with.

## Settings

### Preferences

Toggles for how chats are displayed: highlight character dialogue, auto-fix Markdown formatting issues, and block external media. Changes are saved per browser.

### Profile

See your username and change your password. Changing your password signs out all other sessions.

## Admin panel

### User management

See all accounts on the server in a searchable, filterable table. Make another user an admin (or remove admin status), ban users with an optional reason and expiry date, unban them, or delete accounts. Invite a new user by creating their account — generated credentials are shown with copy buttons.

The last admin on the server cannot be deleted or removed.

## Cross-cutting behavior

- **Macros** — `{{char}}` and `{{user}}` are automatically substituted in your messages and prompts, so you can write generically and it adapts to whoever you're talking to.
- **Rich text** — messages support Markdown for bold, italic, code blocks, and more. Code blocks get a copy button.
- **Mobile** — the full app works on phones and tablets with responsive layouts, mobile-optimized navigation, and compact cards.
