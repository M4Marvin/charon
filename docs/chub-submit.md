# Submitting a card to chub (browse + Import JSON)

Chub's form has an **Import JSON** input that fills every field from a
`chara_card_v2` file — name, Creator's Notes, Description, scenario, first
message, alternates, example dialogs and tags. Only the tagline, the
type/rating radios and the avatar are left, and those are two small steps.

## 1. Build the files

```sh
pnpm card-kit submit <card>
```

Writes to `<root>/.cardkit/<card>/`:

| File | Purpose |
|---|---|
| `card.json` | `chara_card_v2` for chub's Import JSON — description (bible), creator_notes (page), alternates, tags |
| `submit.json` | same fields plus tagline, type/rating and avatar path |
| `post-import.js` | the small page script that sets tagline + radios + Create |

Field mapping (verified against the live form):

| Form | Selector | Source |
|---|---|---|
| Name | `#name` | `metadata.md` → Name |
| Creator's Notes | `#description` | `description.html` |
| Description | `#personality` | `personality.md` |
| Initial message | `#first_message` | first greeting |
| Alternate greetings | `textarea` under the `Alternate greetings` item | remaining greetings |
| Tags | Ant multi-select | imported |
| Tagline | `#tagline` | **not in v2 — set after import** |
| Type / Rating | labels `Private` / `🔥 NSFW` | **not in v2 — set after import** |
| Avatar | `#avatar` | `avatar.png` |

## 2. Import JSON

`browse.upload` can only read files under its roots (`/tmp`):

```sh
cp <card>/.cardkit/card.json /tmp/opencode/card.json
```

Then, in the Helium tab on `https://chub.ai/create_character`:

```
upload  input[type=file][accept*='JSON']  /tmp/opencode/card.json
```

The importer fills everything but the tagline. Verify before moving on:
`#name`, `#description` length (page HTML survives), `#personality` length,
`#first_message`, number of `Alternate greetings` textareas, `.ant-tag` count.

## 3. Tagline, type, rating

One eval with `post-import.js`:

```js
await (<contents of post-import.js>)({ tagline, type: "Private", rating: "NSFW", submit: false })
// -> { done: ["tagline","Private","NSFW","alternates:13"] }
```

The script never submits unless `submit: true`.

## 4. Avatar

```sh
cp <card>/avatar.png /tmp/opencode/avatar.png
```

```
upload  #avatar  /tmp/opencode/avatar.png
```

Chub wants a portrait PNG (2:3).

## 5. Create

Read back: tagline length, checked radios, tag count, alternate count. Then
either re-run the script with `submit: true` or click **Create Character**.
Chub sometimes stays on `/create_character` for a few seconds; if the URL does
not change, check `my_characters` before retrying.

## Gotchas

- `#description` is **Creator's Notes** (the page); `#personality` is
  **Description** (the bible). The labels read backwards from the ids.
- The tagline carries the `💬`/`🖼` badge and is set exactly once, after import.
- Always start from a fresh `create_character`; the form keeps typed state.
- Import JSON brings the tags — do not type them again.
- `browse.upload` refuses paths outside its file roots; copy to `/tmp` first.
- If the browser is on the MacBook, the same steps run there against the same
  chub account; only the local paths differ.

## Live snapshot (for the workbench)

After a card exists, the workbench shows `<card>/live.json`:

```json
{ "syncedAt": "2026-11-21T20:00:00Z", "data": { "name": "…", "tagline": "…" } }
```

It is written by a sync step through the browser (chub is unreachable from the
server). Until then the UI says "no snapshot yet".
