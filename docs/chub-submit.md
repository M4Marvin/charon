# Submitting a card to chub (browse, in memory)

The submit plan comes from the card as the tooling sees it — the open MCP
session when there is one, otherwise the package — and is handed to the browser
in one script. **No intermediate files.**

## 1. Build the plan

Through the MCP server (preferred, uses the open session):

```
card_submit { "dir": "/home/marvin/codes/ComfyUI/chub/build/linda" }
-> { "source": "session" | "package", "script": "…", "payload": { … } }
```

`source: "session"` means an open card PNG inside that directory contributed
its fields (unsaved edits included); the tagline and the submit options still
come from the package, because a PNG does not carry them.

From a terminal, the same object is printed by:

```sh
pnpm card-kit submit <card>   # one JSON line: { script, payload }
```

## 2. Fill the form

In the Helium tab on `https://chub.ai/create_character`, run the returned
script with the returned payload in one eval:

```js
await (<plan.script>)(<plan.payload>)
// -> { done: ["name","tagline","description","personality","first_message",
//             "scenario","alternates:13","Private","NSFW","alternates:13"] }
```

It fills: `#name`, `#tagline`, `#description` (Creator's Notes — the page),
`#personality` (Description — the bible), `#first_message`, `#scenario`,
`#example_dialogs`, the alternate greetings (adding rows with **Add Alternate
Greeting** as needed), then clicks **Private** and **🔥 NSFW**. It never clicks
Create unless `payload.submit` is true.

## 3. Tags (real keys)

Ant's multi-select accepts the first synthetic Enter and then stops, so tags
are typed one at a time, in payload order:

```
click  div.ant-form-item:has(label:text-is('Tags')) .ant-select-selector
type   div.ant-form-item:has(label:text-is('Tags')) input   <tag>
press  Enter
```

Verify: every tag renders as `.ant-tag` inside the Tags item.

## 4. Avatar

`browse.upload` reads only under its file roots (`/tmp`), so the file has to be
reachable there — that is the one place a file is unavoidable:

```
upload  #avatar  /tmp/opencode/<card>-avatar.png
```

Chub wants a portrait PNG (2:3).

## 5. Verify, then create

Read back before submitting: tagline length, checked radios, `.ant-tag` count,
number of `Alternate greetings` textareas. Then either re-run with
`submit: true` or click **Create Character**. If the URL stays on
`/create_character`, check `my_characters` before retrying.

## Gotchas

- `#description` is **Creator's Notes** (the page); `#personality` is
  **Description** (the bible).
- The tagline already carries the `💬`/`🖼` badge — do not add another.
- Always start from a fresh `create_character`; the form keeps typed state.
- Session-sourced payloads can differ from the files on disk — that is the
  point: unsaved edits are what gets submitted.
- If the browser is on the MacBook the same steps run there; only `/tmp` paths
  differ.

## Live snapshot (for the workbench)

After a card exists, the workbench shows `<card>/live.json`:

```json
{ "syncedAt": "2026-11-21T20:00:00Z", "data": { "name": "…", "tagline": "…" } }
```

It is written by a sync step through the browser (chub is unreachable from the
server). Until then the UI says "no snapshot yet".
