# Getting started

Charon is a roleplaying app that runs on your own computer. This page walks you through the first run: making an account, running the setup wizard, connecting an AI service, getting a character, and starting your first chat. No terminal is needed. The wizard does the whole setup in your browser.

## You've already installed Charon

This guide assumes Charon is installed and running. If it is not, the README at ../../README.md has the full install steps.

The easy path is one command. On macOS or Linux:

```bash
curl -fsSL https://github.com/M4Marvin/charon/releases/latest/download/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://github.com/M4Marvin/charon/releases/latest/download/install.ps1 | iex
```

The installer puts Charon in your user folder, downloads a private copy of Node.js if you do not have one, verifies the download, and opens the browser for you. It does not need an administrator password.

If you prefer Docker, the README has the build steps. Migrations run automatically on first start, so there is nothing else to do. When Charon is ready, open http://localhost:3000 in your browser.

## Create your account (first run)

The first time you open Charon, the welcome page has one action: **Create your account**. You only see this page on a fresh install; once your account exists, Charon asks you to sign in instead.

1. Open http://localhost:3000.
2. Click **Create your account**.
3. Pick a **username**. It must be at least 3 characters, using letters, numbers, and underscores only.
4. Pick a **password**. It must be at least 8 characters.

You don't need an email address. Your account lives on your own machine, so there is nothing to verify and nothing to confirm in your inbox. After the account exists, sign in with your username and password on later visits.

## The onboarding wizard

After you create your account, you land in the onboarding wizard. It guides you through setup one step at a time, right in the browser, with no commands to type and nothing to install.

The wizard adapts to what you already have. It only shows the steps you still need, in this order:

- **Welcome**: a quick hello to start.
- **Connect an AI provider**: shown only if no provider is set up yet.
- **Get a character**: bring in a character card, or keep the characters already waiting for you.
- **You're all set**: the final step. Click **Start chatting** to leave the wizard.

If you skip a step, the wizard simply moves on. You can come back to any step later from **Settings** → **Onboarding**.

## Connect an AI provider

Charon needs an AI provider, a service that does the thinking for your characters. The provider step in the wizard collects everything it needs:

1. Enter a **Name**, anything you like, for example "OpenAI".
2. Enter the **Base URL**, the web address of the provider's service.
3. Enter your **API key**, your secret key from the provider.
4. Optionally pick a **Default model**, the specific AI you want to talk to.
5. Click **Test connection**. Charon checks the connection and confirms it works.

Your API key stays in your local database. It never leaves your machine except to reach your chosen provider.

Charon works with OpenAI, OpenRouter, Anthropic (via a proxy), a local Ollama install, vLLM, and other OpenAI-compatible services. If your service speaks the same language as OpenAI, Charon can talk to it.

## Get a character

Next, the wizard asks for a character. A character card is a PNG file that carries a full character: name, portrait, personality, and first message. To import one:

1. Click **Import PNG**.
2. Drag and drop a card onto the page, or click to browse.
3. Check that the card is a PNG, in V2 or V3 format, up to 50 MB.

On a fresh install, a few starter characters are already waiting for you, so you can start chatting right away. Keep them, or import your own cards on top of them.

## Start chatting

When you are done, the wizard's final step says you're all set. Click **Start chatting** and you land on your **Chats** list.

Pick a character and click **Start Chat** to begin. The character's greeting appears as the first message. Type in the box at the bottom and press **Enter** to send. The reply streams in as it is written. If the card has several greetings, the first ones are swipeable, so you can pick the opening you like best.

## Need to change something later?

You can revisit the wizard anytime from **Settings** → **Onboarding**. If you skipped a step, it shows you what is missing, and the rest of the app keeps working while you catch up.

## What to try next

- [Chatting](./chatting.md). Swipe between replies, regenerate, impersonate.
- [Characters](./characters.md). Import cards and manage your library.
- [Lorebooks](./lorebooks.md). Give characters background knowledge to draw on.
- [Personas, scenes, and presets](./personas-scenes-presets.md). Tune how the AI writes.
- [Troubleshooting](./troubleshooting.md). For when something misbehaves.

Back to the [overview](./index.md).
