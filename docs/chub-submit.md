# Submitting a card to chub (browse)

Chub's create form is filled by a fixed script, executed in the logged-in
Helium browser through the `browse` tools. The payload is generated from the
card package, so the same card always produces the same fields in the same
order.

## 1. Build the payload

```sh
pnpm card-kit submit <card>
```

Writes to `<root>/.cardkit/<card>/`:

| File | Contents |
|---|---|
| `submit.json` | every form field, tags, type/rating, avatar path |
| `submit-script.js` | the page-side filler (`async (payload) => …`) |

Field mapping (verified against chub's DOM):

| Form | Selector | Package source |
|---|---|---|
| Name | `#name` | `metadata.md` → Name |
| Tagline | `#tagline` | `tagline.txt` |
| Creator's Notes | `#description` | `description.html` |
| Description | `#personality` | `personality.md` |
| Initial message | `#first_message` | first greeting |
| Scenario | `#scenario` | `scenario.md` |
| Example dialogs | `#example_dialogs` | `example_dialogs.md` |
| Alternate greetings | `textarea` under the `Alternate greetings` form item | remaining greetings |
| Character's Note | textarea with `placeholder="Character's Note"` | payload |
| Type / Rating | labels `Private`, `Unlisted`, `Public`, `🔥 NSFW`, `👪 SFW` | payload (Private + NSFW by default) |
| Avatar | `#avatar` (file input) | `avatar.png` if present |

## 2. Fill the form

In a Helium tab on `https://chub.ai/create_character`:

```js
// one eval: install the filler, then run it with the payload
window.__cardSubmit = <contents of submit-script.js>;
await window.__cardSubmit(<contents of submit.json>);
// -> { filled: ["name","tagline","description",…,"alternates:13","Private","NSFW"] }
```

The script refuses to submit unless the payload says `submit: true`; by default
it only fills and reports.

## 3. Tags (real keys)

Ant's multi-select stops accepting synthetic Enter after the first token, so
tags are typed with real key events, one at a time, in payload order:

```
for tag in submit.json.tags:
    click  div.ant-form-item:has(label:text-is('Tags')) .ant-select-selector
    type   div.ant-form-item:has(label:text-is('Tags')) input   <tag>
    press  Enter
```

Check afterwards: every tag renders as `.ant-tag` inside the Tags item.

## 4. Avatar

`browse.upload` against `#avatar` with the absolute path from
`submit.json.avatar`. Chub wants a portrait PNG (2:3).

## 5. Verify, then create

- Read back: `#name`, `#tagline` length, `#description` length (20 KB page
  survives the textarea), alternate count, `.ant-tag` count, selected Type and
  Rating.
- Only then click **Create Character**, either by re-running the script with
  `submit: true` or by clicking the button in the browser.
- Chub sometimes stays on `/create_character` for a few seconds; if the URL
  does not change, look in `my_characters` before retrying.

## Gotchas

- **Vite/dev-server note does not apply here** — this runs on chub, not
  locally.
- `#description` is *Creator's Notes* (the page), `#personality` is the
  *Description* (the bible). The labels read backwards from the ids.
- The tagline already carries the `💬`/`🖼` badge; do not add another.
- The form keeps whatever was typed if the page is not reloaded — always start
  from a fresh `create_character`.
- No tag typing in the script: doing it there silently drops all but the first
  tag.

## Live snapshot (for the workbench)

After a card exists, the workbench shows `<card>/live.json`:

```json
{ "syncedAt": "2026-11-21T20:00:00Z", "data": { "name": "…", "tagline": "…" } }
```

It is written by a sync step through the browser (chub is unreachable from the
server). Until then the UI says "no snapshot yet".
