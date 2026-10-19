# Packaging and onboarding: the accessible path

> Status: proposal, with the install/packaging layer implemented in this branch.
> Detail lives in three review reports referenced at the end. This document is
> the decision record and the build order.

## 1. The problem, in one table

Charon is polished once you are inside it. Getting inside is a developer
exercise.

| Step today | What a non-technical person experiences |
| --- | --- |
| Install Git and Docker Desktop, or Node and pnpm | Two system installs, a reboot, a multi-GB download, a licence question |
| `git clone` the repo | A terminal command they do not understand, in a folder they did not choose |
| `docker compose up -d` | Several minutes of compiler output that looks like an error |
| Write `.env` with two `openssl` secrets | "What is a secret, and why does it have to be 64 characters?" |
| Open `localhost:3000` | A generic "Charon / Get Started" page with no orientation |
| Create an account, then a 4-question wizard | "Question 1 of 4", a radio button and a disabled Next button |
| Connect a provider | "Base URL" and "API key" with no presets and no way to say "I use Ollama" |

The result is a funnel that only converts people who already know what a
terminal is. The product's differentiators — branching, local data, card
import — are invisible until after the hardest step.

## 2. The target funnel

```
Landing page / GitHub README
        │  one command, prerequisites stated inline
        ▼
Installer (no sudo, no Docker, checksum verified)
        │  opens the browser itself
        ▼
First-run welcome (one action: create account)
        │
        ▼
Provider step (provider cards, Ollama detected, model selected)
        │
        ▼
Starter character already selected  ──▶  first reply
```

Four product moments, one command, no config file. Target: under five minutes
from "what is this" to a streamed reply, with no terminal after the first line.

## 3. Packaging ladder

Four tiers, built in order. Each tier serves a different person and none of
them replaces the others.

| Tier | Person | Command | Prerequisites | Status |
| --- | --- | --- | --- | --- |
| 0 | Contributor / homelab | `git clone && docker compose up -d` | Git, Docker | Works; now pulls a prebuilt image instead of compiling |
| 1 | Anyone on macOS/Linux | `curl -fsSL .../install.sh | sh` | none | Script implemented; needs a release to exist |
| 1 | Anyone on Windows | `irm .../install.ps1 | iex` | none | Script implemented; needs a release to exist |
| 2 | Docker user | `docker run ... ghcr.io/m4marvin/charon` | Docker only | Image built from the same release commit |
| 3 | "I will not open a terminal" | Download, double-click | none | Roadmap (Electron, 10–15 dev-days) |

### Tier 0 — Docker, but pull instead of build

The compose file now points at `ghcr.io/m4marvin/charon:latest`, binds
`127.0.0.1` by default, has a healthcheck against `/up`, and asks for no
secrets. Contributors who want to build use the overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

### Tier 1 — the one-liner (the important one)

macOS/Linux:

```bash
curl -fsSL https://github.com/M4Marvin/charon/releases/latest/download/install.sh | sh
```

Windows:

```powershell
irm https://github.com/M4Marvin/charon/releases/latest/download/install.ps1 | iex
```

What the installer does, and why each choice matters:

| Behaviour | Why |
| --- | --- |
| Installs under `~/.charon` (`%LOCALAPPDATA%\Charon`) | No `sudo`, no admin prompt, no system pollution, trivially reversible |
| Downloads a private Node 22 runtime if needed | Removes the only prerequisite; ~30 MB instead of Docker Desktop |
| Verifies the release SHA-256 and **fails closed** | A missing checksum is an error, not a warning |
| Pins to a release asset, not a mutable branch | The script itself is versioned with the release |
| Starts the server on `127.0.0.1` and opens `localhost` | Private by default; the browser origin matches `APP_URL` so auth cookies work |
| Generates and persists two secrets with mode 0600 | The user never sees "secret" or "openssl" |
| Writes a `charon` CLI | start, stop, status, logs, backup, doctor, update, open |
| Never edits the shell profile unless `--add-to-path` | Surprising PATH edits are a trust failure |

The CLI is dependency-free (`bin/charon.mjs`) and doubles as the server entry
for Docker (`charon serve`). It owns configuration so the app does not need to
know it is packaged: it sets `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`ENCRYPTION_KEY`, `APP_URL`, `CHARON_DATA_DIR`, and `LOG_DIR` before importing
the built server.

Data layout:

```
~/.charon/
  app/          .output + drizzle + bin   (replaced by updates)
  data/         charon.db, uploads/, logs/, instance.json, backups/
  runtime/      private Node.js           (only if the system had none)
  bin/charon    shim
```

Updates stage the new tree in `app.new`, validate it, stop the server, swap,
and roll back on failure. Chats never live in `app/`.

### Tier 2 — the image

The runtime image is a two-stage build: compile with `python3 make g++` in the
build stage, then copy only `.output`, `drizzle`, and `bin` onto
`node:22-slim`. It runs as `node`, not root, and the data volume is
`/app/data`.

Measured inputs: `.output` is 62.5 MiB raw and 27 MB gzipped. `node:22-slim`
is ~80 MB compressed. Expect a ~90–100 MB pull, below Open WebUI's 197 MB
`:slim`. Optional trimming (foreign `better-sqlite3` prebuilds and musl libvips)
can take another ~15 MB; do it after the first release works.

Releases are built locally with `scripts/release-local.sh` — no GitHub Actions.
The script builds `.output`, fetches the non-host Sharp binaries from npm,
assembles the four tarballs plus the Windows zip, writes checksums, and
publishes with `gh release create`. The Docker image is built from the same
commit and pushed to GHCR manually.

### Tier 3 — desktop (defer)

Electron, not Tauri, for v1: the app is already Node; Electron supplies Node +
Chromium + electron-builder + electron-updater. The shell should stay dumb —
boot the bundled server on `127.0.0.1`, put the window on it, store data in
`app.getPath("userData")`, prompt before updating. Budget 10–15 dev-days plus
$99/yr Apple and ~$10/mo Windows signing. Do this after Tiers 1–2 have real
users, not before.

## 4. What this branch changes

| File | Change |
| --- | --- |
| `bin/charon.mjs` | New. Zero-dependency launcher/CLI: start, serve, stop, status, logs, backup, doctor, update. Generates 0600 secrets, sets a private umask, binds localhost, consistent `APP_URL`, staged updates |
| `scripts/install.sh` | New. POSIX installer, private Node runtime, checksum fail-closed, no sudo, idempotent, uninstall/purge |
| `scripts/install.ps1` | New. Windows parity: private Node zip, checksum verify, `charon.cmd`, user PATH |
| `src/server/private-fs.ts` | Uploads root honours `CHARON_DATA_DIR`, so packaged data lives outside the replaceable app directory |
| `Dockerfile` | Two-stage, non-root, `NODE_ENV=production`, healthcheck, `charon serve` |
| `docker-compose.yml` | Prebuilt GHCR image, loopback binding, no secret defaults, healthcheck |
| `docker-compose.build.yml` | Contributor overlay for local builds |
| `scripts/release-local.sh` | Local release build: per-platform tarballs/zips, checksums, `gh release create` (no Actions) |
| `README.md` | Rewritten for a non-technical first-time user; honest about limitations |
| `src/routes/index.tsx` | State-aware landing page: first-run welcome or marketing hero, OS install tabs with copy feedback, features, branch diagram, privacy, FAQ |
| `src/routes/__root.tsx` | Landing page owns its nav; SFW meta description |
| `src/components/Header.tsx` | Removed the dead-end "Create account" button for logged-out visitors |
| `src/lib/models-dev.ts`, `src/lib/models-dev.json`, `scripts/sync-models-dev.mjs` | Offline provider/model catalog generated from models.dev |
| `src/features/onboarding/persona-step.tsx` | Optional "Who are you?" step; creates/updates the default persona |
| `src/lib/default-prompts.ts` | Narrative system, post-history, and impersonation defaults |
| `src/fonts.css`, `static/fonts/` | Self-hosted Inter, Fraunces, JetBrains Mono (OFL) |
| `src/server/seed-portraits.ts`, `scripts/build-seed-portraits.mjs` | Three public-domain starter portraits, inlined for every install |
| `static/marketing/` | S1–S6 SFW screenshots (WebP) used by the landing Tour and README |
| `NOTICE` | Records the AGPL provenance of `src/lib/st-core`, the font licenses, and models.dev attribution |

## 5. The onboarding fixes that matter more than packaging

Installing is necessary, not sufficient. These are the product changes that
turn a successful install into a first reply. Ordered by impact per day.

### P0 — before any marketing push

1. **Provider step: presets from models.dev. — DONE**
   The step is now provider cards plus a searchable model list. The catalog is
   a committed models.dev snapshot (src/lib/models-dev.json, 12 providers,
   338 models, 59 KB), so it works offline. Local providers (Ollama, LM Studio)
   are keyless, can be probed with **Detect models**, and the endpoint is tested
   *before* the provider is saved. "Save without testing" remains as an escape
   hatch for networks that block /models.
   Files: src/features/onboarding/provider-step.tsx, src/lib/models-dev.ts,
   scripts/sync-models-dev.mjs, src/server/fns/models.ts,
   src/server/fns/aiProviders.ts.
   Remaining: validate the preset base URLs against each live provider, and add
   a refresh button that re-fetches models.dev on demand.

2. **Remove the welcome step and its dead Next button. — DONE**
   The wizard now starts at the provider (or persona, if a provider exists).
   The "Question N of M" label was replaced with "Step N of M".

3. **Skip the character step when characters exist. — DONE**
   The step (and its JSX) only renders when `hasCharacter` is false. A fresh
   install goes provider → persona → ready.

4. **Make `/` state-aware. — DONE**
   beforeLoad reads getSetupRequired() and getSession(); the page renders a
   first-run welcome or the marketing page, each with one filled action. The
   global header is hidden on /, and the dead-end "Create account" button is
   gone. Files: src/routes/index.tsx, src/routes/__root.tsx,
   src/components/Header.tsx.

5. **Ship SFW starter characters with portraits. — DONE**
   Three public-domain portraits are inlined in `src/server/seed-portraits.ts`
   and written to private uploads on first run: Captain Elias Thorne,
   Dr. Margaret Finch, and Lucien Vane. One Harborlight lorebook covers the
   setting. The seed test asserts the trio and the lorebook.

6. **Remove the Google Fonts request. — DONE**
   Inter, Fraunces, and JetBrains Mono are self-hosted from static/fonts/
   (latin + latin-ext, six woff2 files, ~300 KB). src/styles.css imports
   src/fonts.css and the interface makes no font-CDN request. The SIL OFL
   texts ship beside the files.

7. **Resolve the license before saying "open source" in public.** (decision)
   `src/lib/st-core` is copied from SillyTavern (AGPL-3.0) into an MIT repo.
   The honest options are: relicense the combined work to AGPL-3.0 (one day,
   recommended), replace the copied modules (weeks), or obtain permission.
   Do not print "MIT" on the landing page or README until this is decided.

8. **Persona and default prompts. — DONE**
   A new optional "Who are you?" step creates or updates the default persona and
   sets it in settings. The seed now ships a narrative system prompt, a
   post-history instruction that forbids speaking for the user and recapping,
   and an impersonation prompt that stays in the user's voice
   (src/lib/default-prompts.ts, src/server/seed.ts). Existing installs keep
   their own prompts.

9. **Kill the Danbooru default. — DONE**
   The image-prompt compiler no longer names Danbooru or anime, and the default
   style suffix is neutral (cinematic composition, natural lighting, detailed,
   painterly). The capability stays; the branded default is gone.

### P1 — the next iteration

9. **A no-key demo.** (2–3 days) The most common objection is "I need to buy a
   key before I can see if I like it." A scripted local reply mode for the
   starter characters — clearly labelled as a demo — removes that.
10. **Test before save.** (1 day) The provider is persisted before its
    connection test; a typo leaves onboarding "complete" but broken.
11. **Account friction.** (2–3 days) A local single-user app asking for a
    username, password, and confirmation is three fields of pure friction.
    Consider auto-creating the owner and offering an optional password before
    LAN exposure. This needs a security review; do not ship it casually.
12. **Marketing assets from a clean profile. — DONE**
    S1 chat (2/3 branch), S2 library, S3 providers, S4 branch close-up, S5
    import, and S6 mobile were captured from a fresh database with the SFW trio
    and are committed as WebP in `static/marketing/`. The Tour section and
    README use them.
13. **`npx charon-app`.** (5–8 days) A single npm package that resolves
    `sharp`/`better-sqlite3` at install time. The npm name `charon` is taken;
    `charon-app` is available. This is a distribution channel, not the primary
    one.

### P2 — later

14. Desktop app (10–15 days), auto-start, signed installers, update channels.
15. Per-chat lorebook activation (a known correctness gap).
16. A real docs site instead of GitHub-rendered markdown.

## 6. The webpage and the GitHub page

The landing page is implemented in `src/routes/index.tsx`, following the
specification in `.review/packaging/design-landing.md` (1,800 lines: full copy,
wireframes, states, accessibility, screenshot list). The Tour section uses the
SFW captures in `static/marketing/`: S1 chat with a 2/3 branch, S2 library,
S4 branch close-up, and S6 mobile. S3 providers and S5 import are captured
alongside them for the README and future docs.

The short version:

**Three states, one route.** `/` must know whether this is a fresh install
(needs setup), a logged-out owner, or a stranger. Each gets exactly one filled
button. The current page tries to be all three and dead-ends two of them.

**Hero.** H1 "A private home for your AI characters." Lede: a chat app for
stories and roleplay that runs on your computer, keeps every branch, uses your
own key. One install card with OS tabs, the command in selectable text, the
prerequisite as step one, and a plain-English "what this does" disclosure.
No screenshots above the fold: the command is the LCP.

**Proof.** A tour section with SFW screenshots (chat with a visible swipe
counter, library, settings), a branch diagram, six feature cards, a privacy
section with the honest caveat that cloud providers see your messages, a nine-
question FAQ, and one final CTA.

**Words we do not use:** unfiltered, uncensored, no filter, AI girlfriend,
companion, waifu, Danbooru. **Words we do use:** story, character, roleplay,
your machine, your key, branch.

**GitHub page.** The README is the real landing page for anyone who does not
have Charon yet. It now leads with the one-liner, states prerequisites inline,
answers "Is this NSFW?" plainly, and lists the known rough edges rather than
letting users discover them. It now opens with the S1 chat capture and the
Tour section carries the library and mobile shots.

## 7. Non-NSFW positioning

The product capability does not change. The packaging, defaults, and language
do.

| Do | Do not |
| --- | --- |
| Lead with "stories and roleplay", "characters", "your own model" | Lead with "unfiltered", "no restrictions", "uncensored" |
| Ship SFW starter characters with portraits | Screenshot a real library that contains adult cards |
| Say "you choose the model" | Imply the app has no moderation layer as a feature |
| Answer "Is this NSFW?" with a plain no | Ignore the question and let the Chub association answer it |
| Market on r/LocalLLaMA, r/SillyTavernAI, Show HN, Product Hunt | Post in adult-oriented communities to seed growth |
| Keep character import agnostic | Curate or host a character marketplace |

Important honesty constraint: because the app is local and the user brings
their own model, it cannot guarantee SFW output and does not filter. The claim
must be "we ship SFW starters and present this as a story tool", not "this app
is safe for children". Put an 18+ note in the README if the app will be
distributed to a general audience in any form; a desktop app in app stores will
need a moderation story.

## 8. Trust requirements for a `curl | sh` install

If the script is not trustworthy, the funnel is worse than Docker because it
asks for blind trust.

- **Readable first.** The script is plain POSIX shell, linked from the page,
  and supports `--dry-run`.
- **Pinned and checksummed.** The one-liner points at a release asset, not a
  mutable branch. The release tarball's SHA-256 is verified; a missing checksum
  is a hard failure.
- **No privilege.** No `sudo`, no system-wide install, no shell-profile edit
  unless explicitly requested.
- **Predictable writes.** Everything goes under one directory; uninstall is
  documented; `--purge` requires typing `delete`.
- **Signed images.** GHCR images are built from the tagged commit, published
  multi-arch, accompanied by SBOM/provenance, and signed with cosign keyless.
- **Visible releases.** Release notes name the commit and the checksums; the
  install scripts are attached as assets.
- **A manual path.** The Docker command and the source instructions remain in
  the README for people who will not pipe a script.

## 9. Build order and effort

| Week | Work | Outcome |
| --- | --- | --- |
| 1 | P0 4–7 (CTA state, fonts, starters, license decision), tag `v0.1.0` | The installer works end to end; the page no longer lies |
| 2 | P0 1–3 (provider cards, welcome/character cleanup), publish GHCR | A non-technical user reaches a reply without help |
| 3 | SFW screenshots, landing page implementation, README polish | A page that can be shown to strangers |
| 4 | Launch posts, feedback loop, fix the top three issues | Real users, real friction data |
| 5–8 | No-key demo, `npx`, Electron spike | Lower-friction tiers |

Total packaging effort: ~25–35 dev-days for Tiers 0–3. The scripts, Docker
changes, and CI in this branch cover roughly the first 30% of Tier 1–2.

## 10. Validation performed

| Check | Result |
| --- | --- |
| Lint | oxlint 0 errors on 397 files |
| Unit/integration tests | 78 files / 799 tests passed when validated. A concurrent chat-settings refactor in the same working tree later broke 5 unrelated tests and its own typecheck; the files changed here are clean. |
| User-docs verification (`pnpm check:docs`) | All 8 checks pass |
| Installer, local tarball, fresh home | Installs to `~/.charon`, `/up` returns 200, `doctor` passes, uninstall guards refuse `$HOME` and unrelated directories |
| Data placement and permissions | DB, secrets, logs, uploads under `data/`; 700 dirs, 600 files; no `app/data` |
| CLI lifecycle | `start`, `status`, `backup`, `doctor`, `stop` verified; backups contain DB + uploads + `instance.json` |
| Docker image (linux/amd64) | Builds; runs as uid 1000; `/up` 200; `/setup` 200; data 700/600 |
| Landing page SSR | 320 / 390 / 1440 px, no horizontal overflow, no console errors |
| models.dev catalog | 319 chat models across 12 providers, 59 KB, bundled offline |
| Provider + persona onboarding | Fresh-install walkthrough: provider cards, model search, keyless local path, save-time probe, persona save; no console errors |
| Self-hosted fonts | Six woff2 files (Inter, Fraunces, JetBrains Mono); zero `fonts.googleapis`/`fonts.gstatic` references in the built CSS |
| Starter pack | Fresh account seeds exactly three portrait'd characters (Elias Thorne, Margaret Finch, Lucien Vane) and the Harborlight lorebook; bootstrap test passes |
| Onboarding steps | Welcome step removed; provider is step 1, character step auto-skips when the library is non-empty; 7 wizard tests pass |
| Marketing captures | S1 chat (2/3), S2 library, S3 providers, S4 branch close-up, S5 import, S6 mobile captured from a fresh SFW profile; WebP derivatives in `static/marketing/` |

Validated: the latest release is published, all five platform asset URLs return 200, the
published installer dry-run resolves the release, and the linux-x64 archive
installs and serves `/up`. Not yet validated: the Windows installer on a real
Windows machine, a macOS run, and the preset base URLs against each live
provider.

The license question is deprioritized by the owner (not selling; obfuscation is
an option if it ever matters). `NOTICE` stays factually accurate for the
AGPL-derived `src/lib/st-core`, and release artifacts carry `LICENSE`,
`NOTICE`, `README.md`, and `SOURCE.txt` so the provenance travels with the
build. No further action unless this is distributed commercially.

## 11. Open questions for Marv

1. **License:** deprioritized by the owner — not selling; obfuscate if it ever
   becomes a problem. No action needed now.
2. **Audience:** is the primary persona the SillyTavern refugee (technical, but
   tired) or the never-touched-a-terminal user? The ladder serves both, but
   the landing copy and the desktop-app priority depend on the answer.
3. **Domain:** register `get.charon.app` / `charon.chat`? The one-liner is much
   more trustworthy from a short domain than from a raw GitHub URL.
4. **Desktop timing:** build Electron now for the non-technical story, or wait
   for installer data? My recommendation is wait; the installer is cheaper and
   proves demand.
5. **Windows signing:** do you qualify for Azure Trusted Signing at the
   individual rate? If not, budget an OV certificate.
6. **Marketing channels:** are you willing to post on r/SillyTavernAI given its
   NSFW-adjacent reputation, or do you want to stay on r/LocalLLaMA and
   Show HN?

## 12. Sources

- `.review/packaging/adversarial-funnel.md` — persona walk-throughs, README
  audit, security gates, P0/P1/P2 fixes.
- `.review/packaging/design-landing.md` — landing IA, final copy, install
  widget spec, accessibility, screenshot shot list.
- `.review/packaging/packaging-research.md` — competitor install flows,
  native-module constraints, image math, costs, SFW channel research.
- `CONTRIBUTING.md` — architecture and conventions.
- `docs/marketing-campaign.md` — the earlier campaign brief; its "zero API key"
  claim and "no filtering" positioning are superseded by sections 5 and 7 here.
