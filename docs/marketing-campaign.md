# Charon — Marketing Campaign

> **Product:** Charon — a self-hosted AI character roleplay app (web, TanStack Start, SQLite).
> **Campaign goal:** Take Charon from "a tool Marv built for himself" to a polished, widely-used self-hosted roleplay app.
> **Audience:** SillyTavern and Chub users who are frustrated, curious, or privacy-minded; self-hosters; the AI-roleplay subreddits and Discords.

---

## 1. Positioning

### 1.1 The origin story (the hook)

Every good self-hosted product has an origin story, and Charon's is the campaign's emotional core:

> _"I loved SillyTavern's power. I loved Chub's character library. But SillyTavern setup is a project, Chub is a walled garden, and neither does conversation the way I actually roleplay — where nothing is ever lost and every branch of the story stays reachable. So I built Charon: the app I wanted, self-hosted, private, and done properly."_

This is authentic (it's true), relatable (every power user has felt this), and it immediately signals the value proposition: **Charon combines Chub + SillyTavern into one clean, self-hosted web app — without the parts that frustrate.**

### 1.2 Positioning statement

> **For AI roleplay enthusiasts who are frustrated by SillyTavern's setup burden and Chub's limitations, Charon is a self-hosted character chat platform that treats conversation as a branching tree — so no reply is ever lost — while making first-run setup a guided 2-minute walkthrough. Unlike SillyTavern, it installs in one command and configures itself in the browser; unlike Chub, your data, keys, and characters stay on your own machine.**

### 1.3 Tagline options

| Tagline                                                        | Angle                      | Use                  |
| -------------------------------------------------------------- | -------------------------- | -------------------- |
| **Every reply is a branch. Nothing is ever lost.**             | Core differentiator (tree) | Landing page hero    |
| **The AI roleplay app you host yourself.**                     | Positioning                | Header / OG          |
| **Your characters. Your keys. Your machine.**                  | Privacy                    | Social proof cards   |
| **SillyTavern's power. Chub's library. None of the friction.** | Competitor                 | Launch post headline |

---

## 2. Who it's for (personas)

### Persona A — "The ST Refugee" (primary)

**Profile:** Mid-level power user. Has used SillyTavern for a year+. Loves the power; hates the maintenance: `config.js` fiddling, UI density, world-info complexity, occasional breakage after updates.
**Pain:** Setup and upkeep; the mental tax of a dense, dated UI.
**Charon's answer:** 1-command install (Docker), guided onboarding wizard, clean glassy UI, ST-grade lorebooks and markdown under the hood.

### Persona B — "The Chub Browser"

**Profile:** Spends hours browsing Chub for character cards. Wants to _talk_ to characters, not fight tooling.
**Pain:** Chub is a marketplace, not a chat app; cards go to a separate tool (often ST) to actually chat.
**Charon's answer:** Import Chub PNGs directly — names cleaned up automatically, embedded lorebooks extracted. "From Chub to chatting in 30 seconds."

### Persona C — "The Privacy Maximalist"

**Profile:** Wants AI roleplay without sending everything through a third-party cloud; runs local models (Ollama) or self-hosts everything.
**Pain:** Cloud apps log prompts; ST desktop stores everything locally but is awkward to run remotely.
**Charon's answer:** Self-hosted, SQLite-only, zero telemetry, API keys encrypted at rest, works with Ollama/vLLM, Docker deploy. _"There is no 'we' — we can't see your data."_

---

## 3. Messaging pillars (with proof points)

Five claims, each backed by a real product behavior. Lead with Pillar 1 — it's the claim nobody else can make.

### Pillar 1 — "Conversation is a tree, not a tape." ★ flagship

**Claim:** Every swipe creates a new branch. Nothing is ever overwritten or lost. Climb back, take a different path, edit any message, delete a branch cleanly.
**Proof points:**

- Swiping left/right under any AI message shows alternate replies (`2/3` counter).
- Regenerate, continue, and swipe all grow the tree as first-class branches.
- Delete prunes only that branch; the rest of the story is untouched.
- Interrupted generations self-heal (5-minute lock recovery).
- A character's multiple greetings are swipeable from message one.
  **Why it wins:** SillyTavern's swipe keeps a hidden history list; it doesn't model branches as a navigable structure. Charon's tree is the first time "what if this reply had gone differently?" is a first-class, persisted, always-reachable answer.

### Pillar 2 — "Try it before you plug in anything."

**Claim:** Charon is the only self-hosted roleplay app that demos the full chat experience with **zero API keys**.
**Proof points:**

- No provider configured? The app replies with believable fallback responses — so you can test swipes, branching, edit, and the whole UI before spending a cent.
- The first-run wizard tests your provider connection live (latency in ms + model count) before you commit.
- Works with OpenAI, OpenRouter, Anthropic-via-proxy, Ollama, vLLM, and any OpenAI-compatible endpoint.
  **Why it wins:** Every alternative hard-stops at "you need an API key." Charon de-risks the first 5 minutes.

### Pillar 3 — "Bring your whole library."

**Claim:** Your existing ST/Chub collection imports cleanly, with cleanup done for you.
**Proof points:**

- Character card V2 + V3 PNG import, with a preview screen that flags validation issues and duplicates.
- Chub cards: display names derived from the Chub slug (no more `m4a_62f3d9c1_...` filenames).
- Embedded lorebooks in cards are auto-extracted into standalone, usable lorebooks.
- SillyTavern world-info JSON import for lorebooks; full data migration script for ST folders.
  **Why it wins:** "Switching is easy because I keep everything" is the #1 adoption barrier. Charon removes it.

### Pillar 4 — "One instance. All your devices."

**Claim:** Self-host Charon once and use it from your desktop, laptop, and phone — a single-user app that isn't locked to one machine.
**Proof points:**

- One self-hosted instance, SQLite-only; the responsive web UI runs on any device.
- No accounts to manage, no seats to pay for, no signup flow to run.
- Your library, chats, and personas are one local dataset you fully control.
  **Why it wins:** Most self-hosted roleplay tools are desktop apps tied to a single machine; Charon is one private instance you reach from anywhere.

### Pillar 5 — "Private by architecture, not by promise."

**Claim:** Self-hosted, SQLite-only, zero telemetry, keys encrypted at rest.
**Proof points:**

- Runs entirely on your machine (Docker or pnpm). Data is one local SQLite file.
- No analytics, no tracking, no cloud dependency (grep the codebase: there is none).
- API keys stored encrypted; password changes invalidate other sessions.
- Optional hardening: block external media in messages; message CSS is sandboxed and cannot touch your app.
  **Why it wins:** Privacy is the default, not a premium tier.

---

## 4. Competitive landscape

### vs SillyTavern

| Axis               | SillyTavern                        | Charon                                        |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| Setup              | Multi-step config, manual          | 1 command + guided wizard                     |
| Conversation model | Linear chat + hidden swipe history | Navigable branching tree, nothing lost        |
| UI                 | Dense, utilitarian, desktop-first  | Clean glassy web UI, mobile-responsive        |
| First-run          | "Read the docs, edit the config"   | In-browser onboarding with live provider test |
| Installation       | Desktop app / manual               | Docker or pnpm, web app on any device         |

### vs Chub

| Axis     | Chub                   | Charon                            |
| -------- | ---------------------- | --------------------------------- |
| Role     | Character marketplace  | Chat app                          |
| Cards    | Browse & download      | Import & chat, names auto-cleaned |
| Data     | Cloud-hosted           | On your machine                   |
| Chatting | Requires external tool | Built-in, with branching          |

### vs generic "AI chat apps" (C.AI, Character.AI, Janitor)

| Axis         | Cloud apps                  | Charon                                         |
| ------------ | --------------------------- | ---------------------------------------------- |
| Data         | Their servers, their ToS    | Your machine                                   |
| Filtering    | Platform moderation         | None but yours                                 |
| API choice   | Locked-in                   | Bring any OpenAI-compatible model, incl. local |
| Cost         | Subscription or per-message | Your own key                                   |
| Conversation | Linear                      | Branching tree                                 |

### Honest tradeoffs (use these in the launch post to build trust)

- **Lorebooks activate globally**, not per-chat (deliberate for now; keep books for one story off, or accept leakage).
- **No character marketplace** — you bring cards from Chub/ST; Charon is the chat home, not the storefront.
- **No hosted cloud service by default** — that's the point; it runs on your own machine.
- Requires a provider or local model for real AI replies (fallback mode covers the first run).

---

## 5. Brand notes

- **Name:** Charon — the ferryman of Greek myth who carries souls across the Styx. The metaphor writes itself: Charon ferries your characters (and your chats) from the old apps into a new, private home. Use it in copy: _"Board the ferry. Bring your characters."_
- **Visual identity:** Deep-ocean navy (`#0a1418`) + teal (`#2dd4bf`). Minimal sailboat mark over waves. Dark-first, clean, developer-credible.
- **Current tagline (OG):** "Self-hosted AI character chat platform" — keep as the canonical descriptor.

---

## 6. Landing page (copy block)

> **Hero (H1):** Every reply is a branch. Nothing is ever lost.
> **Sub:** Charon is the self-hosted AI roleplay app that combines SillyTavern's power with Chub's library — with a guided setup, a branching-tree conversation model, and zero telemetry. Your characters, your keys, your machine.
> **CTA:** `docker compose up -d` · [GitHub](https://github.com/M4Marvin/charon)
> **Proof strip:** ✓ Zero API keys needed to try it · ✓ Imports V2/V3 cards & ST lorebooks · ✓ Works with Ollama, OpenAI, OpenRouter · ✓ MIT licensed

**Section 2 — "The tree."** Every swipe grows a branch. Regenerate, continue, edit, delete — your canon is never overwritten. Climb back to any fork and take the other path. (Screenshot: chat with visible `2/3` swipe counter + branch indicator.)

**Section 3 — "Bring your library."** Chub cards, SillyTavern folders, world-info JSON. Names cleaned, lorebooks extracted, duplicates flagged. From download to chatting in 30 seconds. (Screenshot: import preview screen.)

**Section 4 — "Private by architecture."** SQLite on your disk. No telemetry. Keys encrypted at rest. Message CSS sandboxed. `docker compose up -d` and you're done. (Three-card row: Self-hosted / Zero telemetry / BYO keys.)

**Section 5 — "Yours alone, done properly."** One instance, one user, nothing to administer. `docker compose up -d` and it's yours — your library, chats, and personas in a single local dataset, reachable from any device. (Screenshot: settings / profile.)

**Section 6 — "SillyTavern-grade, without the fight."** Lorebooks with keyword triggers, personas, presets, scenes, impersonation, dialogue-highlighting markdown, and danbooru-style image prompts — all with a clean UI. (Feature grid, 8 tiles.)

**Footer:** _Board the ferry. Bring your characters._ · GitHub · Discord (TBD) · MIT

---

## 7. Channel strategy

### 7.1 Launch channels (highest leverage first)

1. **r/SillyTavernAI** — the exact refugee audience. Post: honest "I got tired of ST's setup burden so I built Charon — here's what's different" with a demo GIF. Include the tradeoffs section preemptively. Soft-sell, Dev-Tool-Energy.
2. **r/LocalLLaMA** — angle: works with Ollama/vLLM, BYO any OpenAI-compatible endpoint, runs fully local. Developer audience → lead with `docker compose up -d` + MIT.
3. **r/ChubAI / character-card communities** — angle: "Import from Chub, names cleaned up, embedded lorebooks extracted, chat immediately." Screenshot-heavy.
4. **GitHub** — polish the repo: screenshots in README, a demo GIF, feature table. Enable Discussions. Watch the star graph; every star is a distribution node.
5. **Discord (create one)** — community support hub; the #showcase channel is where screenshots multiply.
6. **Hacker News (Show HN)** — only when the README + demo are polished. Title: _"Show HN: Charon — self-hosted AI roleplay with branching conversations"_.

### 7.2 Content assets needed (checklist)

- [ ] 60s demo video: fresh install → wizard → import Chub card → first chat → swipe to branch (host on the repo + YouTube).
- [ ] 3 screenshots: chat tree view, import preview, onboarding wizard.
- [ ] Side-by-side GIF: "ST swipe" vs "Charon branch" (the money shot).
- [ ] OG image refresh (exists: `static/og.png`).
- [ ] README hero rewrite (exists; add screenshots + demo link).
- [ ] One technical write-up: "How Charon models conversation as a tree" (developer credibility → r/LocalLLaMA + HN).

---

## 8. 30-day launch calendar

**Week 0 — Polish**

- README screenshots + demo GIF; fix the known doc gap (onboarding wording).
- Create Discord server.

**Week 1 — Groundwork**

- Post GitHub release `v1.0.0` with changelog + screenshots.
- Publish the "conversation as a tree" technical write-up.
- Drop teaser screenshots in r/SillyTavernAI (no link yet — build curiosity).

**Week 2 — Launch**

- Launch post on r/SillyTavernAI (the "I built this because..." story + tradeoffs honesty).
- Same-week post on r/LocalLLaMA (local-model angle).
- Show HN (if README is clean).

**Week 3 — Community**

- r/ChubAI post (import flow).
- Reply to every comment; collect feedback; log it (frog log).
- Start #showcase on Discord.

**Week 4 — Iterate**

- Ship 1-2 quick wins from feedback (visible responsiveness = momentum).
- Second wave: screenshots/videos from real users.
- Evaluate: which channel drove installs? Double down.

---

## 9. Success metrics

| Metric                               | Target (30 days)                  | Why it matters                                                     |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| GitHub stars                         | 100+                              | Distribution + social proof                                        |
| Release downloads                    | 200+                              | Funnel top; visitors hit the fallback/onboarding magic immediately |
| Docker pulls                         | 100+                              | Real install signal                                                |
| Reddit engagement                    | 100+ comments across launch posts | Community feedback loop                                            |
| Discord members                      | 50+                               | Retained community                                                 |
| First user-requested feature shipped | 1                                 | Proof the project listens                                          |

**North star:** _a first-time visitor goes from "docker compose up" to a branched conversation with an imported character in under 10 minutes._ Everything in the campaign funnels to that moment.

---

## 10. Risk & honest-conversation plan

- **"Why not just use SillyTavern?"** — Answer with the tree: "If you never want to lose a reply and hate setup, Charon is built for you. If you live inside ST's ecosystem, Charon imports your whole library so there's no lock-in — try both."
- **"Why not just use Chub?"** — "Chub is where you _find_ characters. Charon is where you _talk_ to them — on your machine, with branches."
- **"It's just one developer, what if it dies?"** — MIT + SQLite + plain formats (PNG cards, JSON lorebooks) = no lock-in, your data outlives any project. This is a feature; say it.
- **Feature gaps surface in public** — lead with the tradeoffs section, log every request, ship visible responsiveness. Open-source trust beats perfection.

---

_Campaign owner: Marv. Last updated: 2026-08-10. Sources: codebase walkthrough (`CONTRIBUTING.md`, `docs/_`, `src/features/chat/_`), README, license (MIT)._
