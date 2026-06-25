import { type } from "arktype";
import {
  DEFAULT_LORE_CONFIG,
  LoreEntrySchema,
  type LoreConfig,
  type LoreEntry,
} from "@/lib/st-core/lorebook";

// Parse a SillyTavern world-info JSON file into a shape ready for insertion
// into the lorebooks + lore_entries tables.
//
// World file shape (loose — the wild is messy):
//   {
//     "name": "World Name",
//     "description": "...",
//     "scanDepth": 10,
//     "entries": {
//       "0": { "uid": 0, "key": [...], "keysecondary": [...], "comment": "...",
//              "content": "...", "constant": false, "selective": false,
//              "insertion_order": 100, "enabled": true,
//              "position": "before_char" | "after_char" | 0 | 1,
//              "use_regex": true,
//              "extensions": { "position": 0, "exclude_recursion": false,
//                               "depth": 4, "selectiveLogic": 0, "group": "",
//                               "group_override": false, "group_weight": 100,
//                               "probability": 100, "useProbability": true,
//                               "automation_id": "", "role": 0,
//                               "triggers": [], "ignore_budget": false } },
//       ...
//     }
//   }
//
// Differences from the st-core `LoreEntry` shape:
//   - `insertion_order` -> `order`
//   - `enabled: true` -> `disable: false`  (inverted semantics)
//   - `position: "before_char" | "after_char"` -> 0 | 1 (LorePosition enum)
//   - `key` / `keysecondary` may be a comma-separated string OR array
//   - extension fields live under `extensions.*` with snake_case names
//
// The migration (`scripts/migrate-data.ts`) stores raw entries without
// normalization — that means migration-imported lorebooks can't be used by
// the pipeline. This parser normalizes properly so imported lorebooks are
// immediately usable in chats.

export interface ParsedWorldFile {
  name: string;
  description: string | null;
  config: LoreConfig;
  entries: LoreEntry[];
  entriesSkipped: number;
}

interface WorldEntryRaw {
  uid?: number;
  key?: string[] | string;
  keysecondary?: string[] | string;
  comment?: string;
  content?: string;
  constant?: boolean;
  selective?: boolean;
  insertion_order?: number;
  enabled?: boolean;
  position?: number | "before_char" | "after_char";
  use_regex?: boolean;
  // Catch-all so we can read `extensions` even with unknown extra fields.
  [k: string]: unknown;
  extensions?: Record<string, unknown>;
}

interface WorldFileRaw {
  name?: string;
  description?: string;
  scanDepth?: number;
  entries?: Record<string, WorldEntryRaw>;
  [k: string]: unknown;
}

function normalizeKeyArray(value: string[] | string | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.filter((s) => typeof s === "string");
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

function normalizePosition(raw: unknown): 0 | 1 {
  if (raw === 1 || raw === "after_char") return 1;
  return 0; // default Before; also covers 0, "before_char", undefined
}

function normalizeWorldEntry(raw: WorldEntryRaw, fallbackUid: number): LoreEntry | null {
  const ext = (raw.extensions ?? {}) as Record<string, unknown>;
  const entry: LoreEntry = {
    uid: typeof raw.uid === "number" ? raw.uid : fallbackUid,
    key: normalizeKeyArray(raw.key),
    keysecondary: normalizeKeyArray(raw.keysecondary),
    comment: typeof raw.comment === "string" ? raw.comment : "",
    content: typeof raw.content === "string" ? raw.content : "",
    constant: raw.constant === true,
    selective: raw.selective === true,
    order: typeof raw.insertion_order === "number" ? raw.insertion_order : 100,
    position: normalizePosition(ext.position ?? raw.position),
    disable: !(raw.enabled !== false), // default enabled=true → disable=false
    excludeRecursion: ext.exclude_recursion === true,
    preventRecursion: ext.prevent_recursion === true,
    delayUntilRecursion: ext.delay_until_recursion === true,
    depth: typeof ext.depth === "number" ? ext.depth : 4,
    selectiveLogic: typeof ext.selectiveLogic === "number" ? ext.selectiveLogic : 0,
    group: typeof ext.group === "string" ? ext.group : "",
    groupOverride: ext.group_override === true,
    groupWeight: typeof ext.group_weight === "number" ? ext.group_weight : 100,
    probability: typeof ext.probability === "number" ? ext.probability : 100,
    useProbability: ext.useProbability !== false, // default true
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: typeof ext.automation_id === "string" ? ext.automation_id : "",
    role: typeof ext.role === "number" ? ext.role : 0,
    vectorized: false,
    sticky: null,
    cooldown: null,
    delay: null,
    matchPersonaDescription: false,
    matchCharacterDescription: true,
    matchCharacterPersonality: true,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    triggers: Array.isArray(ext.triggers)
      ? (ext.triggers as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    ignoreBudget: ext.ignore_budget === true,
  };

  const result = LoreEntrySchema(entry);
  if (result instanceof type.errors) return null;
  return entry;
}

export function parseWorldFile(json: string): ParsedWorldFile {
  let world: WorldFileRaw;
  try {
    world = JSON.parse(json) as WorldFileRaw;
  } catch (e) {
    throw new Error(
      `Invalid world file: ${e instanceof Error ? e.message : "not valid JSON"}`,
    );
  }
  if (!world || typeof world !== "object" || Array.isArray(world)) {
    throw new Error("Invalid world file: expected a JSON object");
  }

  const name =
    typeof world.name === "string" && world.name.trim().length > 0
      ? world.name.trim()
      : "Imported Lorebook";
  const description =
    typeof world.description === "string" && world.description.trim().length > 0
      ? world.description
      : null;

  const config: LoreConfig = { ...DEFAULT_LORE_CONFIG };
  if (typeof world.scanDepth === "number" && Number.isFinite(world.scanDepth)) {
    config.scanDepth = Math.max(0, Math.floor(world.scanDepth));
  }

  const entries: LoreEntry[] = [];
  let entriesSkipped = 0;
  let nextUid = 1;

  if (world.entries && typeof world.entries === "object") {
    for (const raw of Object.values(world.entries)) {
      if (!raw || typeof raw !== "object") {
        entriesSkipped++;
        continue;
      }
      const entry = normalizeWorldEntry(raw, nextUid);
      if (entry === null) {
        entriesSkipped++;
        continue;
      }
      // Advance nextUid past this entry's uid so the next fallback doesn't collide.
      nextUid = Math.max(nextUid, entry.uid + 1);
      entries.push(entry);
    }
  }

  return { name, description, config, entries, entriesSkipped };
}
