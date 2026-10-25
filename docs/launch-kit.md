# Charon launch kit

Drafts for the first public posts. Adjust the voice, keep the claims true, and
do not post the same text to every platform on the same day.

---

## One-line description

Self-hosted AI character chat with branching conversations, V2/V3 character
cards, lorebooks, and your own model.

## 60-second demo shot list

1. **0:00–0:05** — Landing page, cursor over the install command. Cut before
   the terminal output gets long.
2. **0:05–0:15** — Fresh app, three starter characters. Open Captain Elias
   Thorne.
3. **0:15–0:30** — Send one message. Swipe the reply. Point at the `2/3`
   counter. Swipe back to reply 1. Say: "The old reply is still here."
4. **0:30–0:40** — Open the branch view. Move between two paths.
5. **0:40–0:50** — Import a PNG card. Show the preview and the embedded
   lorebook being extracted.
6. **0:50–0:60** — Settings: provider list, "Ollama" or "OpenRouter", and the
   local data folder. End on the landing page URL.

Record at 1440×900 or 1920×1080, with captions. No music is better than bad
music. Export an MP4 and a 15-second GIF.

---

## LinkedIn

I've been building Charon for myself for a while, and it is finally ready for
other people to try.

Charon is a self-hosted chat app for stories and roleplay. The part I care
about is the conversation model: every reply is a branch. Swipe, regenerate,
edit, or continue, and the version you had stays where it was. You can go three
scenes forward, change your mind, and take the other road without losing the
first one.

It runs on your machine. Your character cards, chats, lorebooks, and provider
key stay in one local data folder. There is no account on my server, no
telemetry, and no subscription. You can bring an OpenAI-compatible key or run a
model locally with Ollama.

It installs in one command on macOS, Linux, and Windows, or with Docker.

The app is free and open source. I would like feedback from people who actually
run long stories with AI characters, especially if you already have a card
library.

Link in the first comment.

---

## X

Every reply is a branch.

Charon is a self-hosted AI character chat app. Bring your V2/V3 cards, connect
your own model, keep every conversation on your machine.

One command to install. Free and open source.

https://chat.m4marvin.com

Follow-up post:

- Import V2/V3 cards and world-info JSON
- Branching tree instead of a hidden swipe history
- OpenAI-compatible APIs or local Ollama
- No telemetry, no cloud account
- macOS, Linux, Windows, Docker

---

## Reddit — r/selfhosted

**Title:** Charon: self-hosted AI character chat with a branching conversation tree

**Body:**

I built Charon because I wanted an AI character chat app where the conversation
is a tree, not a tape. Every swipe, regenerate, edit, or continue creates a
branch you can return to. Nothing is overwritten.

It is single-user and self-hosted:

- one local SQLite database plus an uploads folder;
- V2/V3 PNG character cards, including embedded lorebooks;
- world-info JSON import;
- OpenAI-compatible providers, or Ollama / LM Studio locally;
- provider keys encrypted at rest;
- no telemetry, no cloud account, no subscription.

Install:

```bash
curl -fsSL https://github.com/M4Marvin/charon/releases/latest/download/install.sh | sh
```

or:

```bash
docker run -d --name charon --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v charon-data:/app/data \
  ghcr.io/m4marvin/charon:latest
```

Windows has a PowerShell installer. The Docker image is linux/amd64.

Honest tradeoffs:

- single-user; there are no shared accounts or collaboration features;
- no character marketplace; you bring your own cards;
- lorebook activation is global, not per-chat;
- you need a provider key or a local model for real replies;
- the packaged image is amd64 only; ARM users should use the installer or
  build locally.

I would especially like to hear from people running it on a home server or
behind a reverse proxy. What broke, and what was missing?

GitHub: https://github.com/M4Marvin/charon
Site: https://chat.m4marvin.com

---

## Reddit — r/LocalLLaMA

**Title:** Charon: a self-hosted character chat UI with branching, built for local models

**Body:**

I wanted a chat UI where a long story is a tree instead of a linear transcript.
Charon keeps every swipe and regeneration as a branch, stores everything in one
local SQLite file, and talks to any OpenAI-compatible endpoint. Ollama and LM
Studio are first-class presets.

What is there:

- V2/V3 PNG cards and embedded lorebooks;
- world-info JSON import;
- streaming replies, impersonation, continue, edit, branch delete;
- personas, presets, scenes, and portraits;
- encrypted provider keys, no telemetry;
- macOS/Linux/Windows installer and a Docker image.

It is not trying to be a model runner or a marketplace. It is the chat layer.
You still need a model.

I would like feedback on the local-model path in particular: base URLs,
context handling, and what breaks with smaller models.

GitHub: https://github.com/M4Marvin/charon

---

## Before posting

- [ ] `v0.1.3` is the latest release, and the one-liner installs it.
- [ ] `chat.m4marvin.com` is rebuilt from the same commit.
- [ ] Docker one-liner pulls and starts on a clean machine.
- [ ] The 60-second video and a 15-second GIF exist.
- [ ] X and LinkedIn previews show the OG image and the right title.
- [ ] `SECURITY.md` and the bug template are live.
- [ ] CI is green on `main`.
- [ ] The repo description, topics, and pinned post are current.
- [ ] You have 5–10 people who agreed to try it before the public post.
