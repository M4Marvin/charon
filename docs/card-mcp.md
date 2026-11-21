# Card MCP server

Read and edit a Character Card V2/V3 straight out of a card PNG, with the card
held in memory for the whole session.

The server is part of this repo (`src/mcp/card-server.ts`) and uses the same
`st-core` PNG reader/writer as the app. Node-only, stdio transport.

## Activate

The server is parked in `~/.config/opencode/opencode.json` as `charon-cards`
(`"disabled": true`), like the other on-demand MCPs. Switch it on for the
session's working directory — the connect is per location, so a session in
`~/codes/ComfyUI` needs its own connect:

```sh
DIR=/home/marvin/codes/ComfyUI      # the session's cwd
opencode api post "/api/experimental/mcp/charon-cards/connect?location[directory]=$DIR"
opencode mcp list                   # expect: ✓ charon-cards connected
```

If a call right after connecting fails with `Unknown tool namespace`, wait a
second and retry — the catalog refreshes asynchronously.

From a plain terminal (no client), run it directly:

```sh
/home/marvin/codes/charon/scripts/mcp-card.sh    # stdio JSON-RPC
```

The wrapper `cd`s into the repo first; without that, `tsx` cannot resolve the
`@/` alias from another working directory.

## Use

`card_open` once per file, then edit in memory. Nothing touches the PNG until
`card_save`.

```
card_open   path=/abs/path/card.png        → summary; load once
card_show   path=...                       → spec, name, creator, tags, greetings, image count
card_get    path=... field=data.name       → one value
card_set    path=... field=data.name value="Amanda & Mia"
card_unset  path=... field=data.mes_example
card_json   path=...                       → full JSON incl. unsaved changes
card_save   path=... [out=other.png]       → write to the PNG (.bak on in-place)
card_reload path=...                       → discard changes, re-read the file
card_list                                  → open cards + dirty state
card_close  path=...                       → drop from memory (discards changes)
```

Field paths use dots and indexes: `data.name`, `data.alternate_greetings[2]`,
`data.character_book.entries[0].content`. Values that parse as JSON are stored
as JSON, everything else as a string.

Example sequence for a rebuild:

```
card_open   /home/marvin/Downloads/card.png
card_get    data.personality
card_set    data.creator_notes "<page html>"
card_set    data.alternate_greetings  ["greeting 2", "greeting 3"]
card_save
```

## Behaviour worth knowing

- **State lives in the server process.** Unsaved edits last as long as the MCP
  connection; a restart loses them. Save when a batch of edits is done.
- **Saves are atomic** (temp file + rename) and keep `<file>.bak` for in-place
  writes. `out=` writes elsewhere and leaves the original untouched.
- **V2 and V3 both work.** The writer keeps the `chara` chunk for V2 and emits
  `chara` + `ccv3` for V3, matching the spec.
- **One entry per file**, keyed by the path string you pass. Use the same path
  in every call; `card_list` shows what is open.

## Interactive alternative

For a human at a terminal, `pnpm card card.png` is the same card in a REPL
(`show`, `get`, `set`, `unset`, `json`, `edit`, `save`, `reload`, `quit`).
Both front ends share `src/lib/character/card-session.ts`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `card not open` | call `card_open` for that exact path first |
| `Unknown tool namespace` | connection not finished; retry after a second |
| `Cannot find package '@/lib'` | you ran `tsx` outside the repo — use `scripts/mcp-card.sh` |
| edits gone after restart | expected; the card is memory-resident, call `card_save` |
