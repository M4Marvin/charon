# Card tooling

Everything for taking a card from files to a chub submission: an MCP server
that holds the card in memory, a CLI that checks/renders/reports/submits, and a
workbench page that shows the results.

## Before you start

- Repo: `/home/marvin/codes/charon`, `pnpm install` once.
- `pnpm` is often **not on PATH** in an agent shell. Use
  `~/.local/share/pnpm/bin/pnpm` or prefix
  `PATH=$HOME/.local/share/pnpm/bin:$PATH`.
- Workbench needs the app running: `pnpm dev`. Submit does not.
- Submit needs Helium open and logged into chub; browse drives it.
- In commands, `<card>` is the package directory name under the card root.

## Surfaces

| Surface | Entry point | Use for |
|---|---|---|
| MCP | `pnpm mcp:card` (stdio, `scripts/mcp-card.sh`) | editing a card across many calls |
| CLI | `pnpm card-kit <cmd>` | check / render / report / submit a package |
| Workbench | `/cards` in the app (`pnpm dev`) | looking at checks, renders and images |

Card root: `$CARD_ROOT`, default `~/codes/ComfyUI/chub/build`. Generated output
goes to `<root>/.cardkit/<card>/`.

## Card package

A directory under the root. Files are read in this order:

| File | Field |
|---|---|
| `description.html` | chub Creator's Notes (the page) |
| `personality.md` | chub Description (the bible) |
| `first_message.md`, or `greetings/01.md` | first greeting |
| `greetings/*.md`, or `greetings.md` split on `===` | alternate greetings |
| `scenario.md`, `example_dialogs.md` | optional fields |
| `tagline.txt`, or the badge line in `metadata.md` | tagline |
| `metadata.md` | name, tags |
| `avatar.png`, `card.png` | portraits (2:3) |

Images referenced by URL are rewritten to local files by basename
(`images/final/`, `images/`, `web/`, `art/`, `shots/`) when rendering, so a
render never depends on the file server.

## MCP server

Parked in `~/.config/opencode/opencode.json` as `charon-cards`; connect per
session directory:

```sh
opencode api post "/api/experimental/mcp/charon-cards/connect?location[directory]=$DIR"
opencode mcp list
```

It reads a card PNG once (`card_open`) and keeps it until the process ends.
Save explicitly; unsaved edits die with the connection.

| Tool | Does |
|---|---|
| `card_open` / `card_close` / `card_list` | session lifecycle |
| `card_show` | summary: spec, name, counts, css size |
| `card_get` / `card_set` / `card_unset` | fields by path (`data.alternate_greetings[2]`) |
| `card_find` | regex search → `{field, snippet}` (no full dump) |
| `card_json` | writes `.cardkit/<name>/card.json`, returns the path |
| `card_save` / `card_reload` | write to the PNG / discard edits |
| `card_check` | JSON `{name, ok, stats, issues[]}` |
| `card_render` / `card_report` | screenshots / HTML report |
| `card_submit` | `{source, script, payload}` for the chub form |

Session tools (`card_open` … `card_save`) take a **PNG path** and are keyed by
it; package tools (`card_check`, `card_render`, `card_report`, `card_submit`)
take a **package directory**. Use absolute paths.

## CLI

```sh
pnpm card-kit check  [card ...] [--root DIR] [--network]
pnpm card-kit render [card ...]
pnpm card-kit report [card ...]
pnpm card-kit submit <card>
```

`check` rules:

- tagline `💬 N` and `🖼 M` match the card
- every greeting ends with an image; images are not shared between greetings
- no `**` speaker labels, no alt text, italic narration present, soft length range
- personality does not instruct the model to label speakers; narrator rule present
- `<style>` blocks are wrapped in `<svg>` and stay under the chub limit
- portrait avatar/card when present
- `--network` fetches every image URL
- template drift (a `metadata.md` that no longer parses) is reported, not ignored

`render` builds a chub-shaped shell and screenshots it with **headless Helium
over CDP** (no Playwright): desktop 1280, mobile 390, full page, fresh profile
per run. JPEG thumbnails are written for the workbench. A screenshot under
20 KB fails the render.

## Agent session

```sh
cd /home/marvin/codes/charon
opencode api post "/api/experimental/mcp/charon-cards/connect?location[directory]=$PWD"
# card_open … card_set … card_save, then:
pnpm card-kit check  <card>
pnpm card-kit report <card>   # writes .cardkit/<card>/report.html
```

Review `report.html` (or `/cards`) before publishing. Fix the card, not the
report.

## Workbench

`pnpm dev`, sign in, then `http://localhost:3000/cards` (Vite binds `::1`; `127.0.0.1`
refuses). Per card: renders side by side (scroll inside the frame, click for
the full screenshot), a greeting-image grid, checks and package stats in the
aside, and a Re-render button that runs render + report on the server. Clicking
an image opens a lightbox with ←/→ and Esc.

`/api/cardkit/<name>?file=…` serves only `desktop.png`, `mobile.png`, their
thumbnails, `page.html`, `report.html` and `art/<basename>` through the asset
map.

## Submit

The plan is built from the open MCP session when one exists (`source:
"session"`, unsaved edits included), otherwise from the package. No files are
written.

1. `card_submit { dir }` → `{ script, payload }` (or `pnpm card-kit submit <card>`
   prints the same object).
2. In the logged-in Helium tab on `https://chub.ai/create_character`, run
   `await (<script>)(<payload>)`. It fills name, tagline, Creator's Notes,
   Description, first message, scenario, example dialogs, every alternate
   greeting, then clicks Private and 🔥 NSFW. It does not create unless
   `payload.submit` is true.
3. Tags are typed with real keys, one at a time (Ant's multi-select drops
   synthetic Enter after the first token).
4. `browse.upload` the avatar into `#avatar` (files must be under `/tmp`); the
   form item turns `has-success` and shows the uploaded image.
5. Read back, then click **Create Character**. It submits slowly (the button
   spins for 10–20 s); a second click or a retry creates a phantom slug, so
   wait and check the URL instead.

Alternate greetings need a real pause between **Add Alternate Greeting** clicks
(≈350 ms). React batches a tight click loop and adds none of them.

`#description` is Creator's Notes; `#personality` is Description. Start from a
fresh form every time.

## Failure modes

| Symptom | Cause |
|---|---|
| `card not open` | `card_open` that exact path first |
| `Cannot find package '@/lib'` | ran `tsx` outside the repo — use `scripts/mcp-card.sh` |
| edits gone after restart | memory-resident; call `card_save` |
| `/api/cardkit/<name>/desktop.png` 404s | Vite intercepts image extensions; the API takes `?file=` |
| render has empty frames | art deleted from the server and not present locally |
| tags stop appearing | typed with synthetic events — use real keys |
| no alternate rows added | Add clicked in a tight loop — wait ≈350 ms between clicks |
| `Can not find this entity` right after Create | the submit was still running; wait, then check `my_characters` |
| `pnpm: command not found` | use `~/.local/share/pnpm/bin/pnpm` or set PATH |
| `--network` reports 403 | Cloudflare blocks this machine from `files.m4marvin.com` |
| render has empty frames | the art is missing locally too — upload it or fix the URL |
