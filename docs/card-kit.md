# Card kit — check, render, report

Tooling for a card package directory (`~/codes/ComfyUI/chub/build/<card>/`):
validate the fields, render the page headlessly, and produce one HTML report.

```sh
pnpm card-kit check   [card ...] [--root DIR] [--network]
pnpm card-kit render  [card ...]
pnpm card-kit all     [card ...]
```

Default root: `$CARD_ROOT` or `~/codes/ComfyUI/chub/build`. Output goes to
`<root>/.cardkit/<card>/`: `page.html`, `desktop.png`, `mobile.png`,
`report.html`.

## check

Rules come from `WRITING.md §2.6`, `CARD_WORKFLOW.md §6` and the old
per-card `check.py`:

- tagline `💬 N` equals the greeting count, `🖼 M` the unique image count
- every greeting has an image and it is the last thing in the file
- no `**` speaker labels; italic narration present; soft length range
- personality does not instruct the model to label speakers; narrator rule present
- `<style>` blocks are wrapped in `<svg>` and together stay under the chub limit
- `avatar.png` / `card.png` are portrait if present
- `--network` additionally HEADs every image URL

Exit text is one line per card plus `error`/`warn` lines. The result is a
`CheckResult` (`ok`, `issues[]`, `stats`) for reuse by the web UI.

Image counting includes markdown images, `<img src>`, and CSS `url(...)`
backgrounds (fonts and `data:` excluded) — that is why the hero counts.

## render

`renderCard` builds a chub-shaped shell (header, avatar column with the chat
buttons, content column, `.eedsfu` paragraph colour) and injects the card's
`description.html`. It screenshots it with **headless Helium over CDP** — no
Playwright dependency:

- desktop 1280x900, mobile 390x844, deviceScaleFactor 2, full page
- `HELIUM_BIN` overrides `/usr/bin/helium-browser`
- a fresh `--user-data-dir` each run, devtools port picked per run, profile removed after

**Local art wins.** Every absolute image URL whose basename matches a file in
`images/final/`, `images/`, `web/`, `art/` or `shots/` is rewritten to
`file://`, so renders do not depend on `files.m4marvin.com` (or on the
Cloudflare in front of it).

## What it found on day one

- `amanda-mia` page referenced art that had been deleted from the server — the
  render came out with empty frames, check passed (those URLs only fail under
  `--network`).
- `linda` and `sayuri` tagline image counts were off by one until CSS
  backgrounds were counted; after that all four packages matched.
- `hayashi` keeps its tagline in `metadata.md`; `tagline.txt` is optional and
  the badge line is read from either.

## Limits

- The shell is an approximation of chub's DOM. It reproduces the selectors the
  card CSS targets today; a chub redesign will need the shell updated.
- No browser test: `render` is verified by eye, `check` is unit-tested.
