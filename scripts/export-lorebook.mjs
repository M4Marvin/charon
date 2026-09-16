// One-off: export the first lorebook from dev.db into SillyTavern world-file
// JSON (the shape consumed by src/lib/lorebook/world-file.ts parseWorldFile).
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

const db = new DatabaseSync("dev.db");

const lorebook = db
  .prepare("SELECT id, name, description, config FROM lorebooks ORDER BY created_at LIMIT 1")
  .get();
if (!lorebook) {
  console.error("No lorebooks found");
  process.exit(1);
}

const rows = db
  .prepare("SELECT data FROM lore_entries WHERE lorebook_id = ? ORDER BY uid")
  .all(lorebook.id);

const config = JSON.parse(lorebook.config);

// Reverse of normalizeWorldEntry() in world-file.ts — emit the exact fields
// the importer reads back.
function toWorldEntry(data) {
  return {
    uid: data.uid,
    key: data.key ?? [],
    keysecondary: data.keysecondary ?? [],
    comment: data.comment ?? "",
    content: data.content ?? "",
    constant: data.constant === true,
    selective: data.selective === true,
    insertion_order: data.order ?? 100,
    enabled: !(data.disable === true),
    position: data.position === 1 ? 1 : 0,
    extensions: {
      position: data.position ?? 0,
      exclude_recursion: data.excludeRecursion === true,
      prevent_recursion: data.preventRecursion === true,
      delay_until_recursion: data.delayUntilRecursion === true,
      depth: data.depth ?? 4,
      // Note: importer reads these two as camelCase (world-file.ts quirk)
      selectiveLogic: data.selectiveLogic ?? 0,
      useProbability: data.useProbability !== false,
      group: data.group ?? "",
      group_override: data.groupOverride === true,
      group_weight: data.groupWeight ?? 100,
      probability: data.probability ?? 100,
      automation_id: data.automationId ?? "",
      role: data.role ?? 0,
      triggers: data.triggers ?? [],
      ignore_budget: data.ignoreBudget === true,
    },
  };
}

const world = {
  name: lorebook.name,
  description: lorebook.description ?? "",
  scanDepth: config.scanDepth ?? 10,
  entries: Object.fromEntries(rows.map((r) => {
    const e = toWorldEntry(JSON.parse(r.data));
    return [String(e.uid), e];
  })),
};

const out = `data/${lorebook.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-")}.json`;
writeFileSync(out, JSON.stringify(world, null, 2) + "\n");
console.log(`Wrote ${rows.length} entries from "${lorebook.name}" -> ${out}`);