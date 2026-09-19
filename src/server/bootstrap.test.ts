import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { DEFAULT_IMAGE_PROMPT_EXAMPLE } from "@/features/chat/generation/image-prompt";

// `seedSampleData` / `seedDefaultBackgrounds` call repository functions that
// default to the `db` export from "@/db". Point that export at each test's
// in-memory database so seeding can be asserted without touching a real file.
// The DATABASE_URL assignment is a guard: if the mock ever fails to apply, the
// lazily-initialized real client still never opens dev.db.
const holder = vi.hoisted(() => {
  process.env.DATABASE_URL = "/tmp/charon-bootstrap-guard.db";
  return { db: undefined as unknown as TestDb };
});

vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db")>();
  return {
    ...actual,
    get db() {
      return holder.db;
    },
  };
});

// Seeding copies real background files off disk; stub the fs so tests stay
// hermetic and the default-background source directory does not need to exist.
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  mkdir: vi.fn(async () => {}),
  readdir: vi.fn(async () => ["one.jpg", "two.png"]),
  cp: vi.fn(async () => {}),
}));

import { ensureStartupTasks } from "@/server/bootstrap";
import { seedSampleData } from "@/server/seed";
import { listBackgrounds } from "@/db/repositories/backgrounds";
import { listCharacters } from "@/db/repositories/characters";
import { listEntries, listLorebooks } from "@/db/repositories/lorebooks";
import { listPersonas } from "@/db/repositories/personas";
import { listPresets } from "@/db/repositories/presets";
import { getUserSettings } from "@/db/repositories/userSettings";

describe("ensureStartupTasks", () => {
  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    holder.db = ctx.db;
    vi.clearAllMocks();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("creates the upload directories and seeds the default backgrounds", async () => {
    await ensureStartupTasks();

    const fs = await import("node:fs/promises");
    const mkdirCalls = (fs.mkdir as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(mkdirCalls).toEqual(
      expect.arrayContaining([
        "data/uploads/avatars",
        "data/uploads/backgrounds",
        "data/uploads/personas",
      ]),
    );
    expect(fs.readdir as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);

    const bgs = listBackgrounds(holder.db);
    expect(bgs).toHaveLength(2);
    expect(bgs.map((b) => b.name).sort()).toEqual(["One", "Two"]);
  });

  it("is idempotent: a second run seeds nothing new", async () => {
    await ensureStartupTasks();
    const seeded = listBackgrounds(holder.db).length;

    await ensureStartupTasks();

    expect(listBackgrounds(holder.db)).toHaveLength(seeded);
    const fs = await import("node:fs/promises");
    expect(fs.readdir as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });
});

describe("seedSampleData", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let userId: string;

  beforeEach(() => {
    ctx = makeTestDb();
    holder.db = ctx.db;
    userId = seedTestUser(ctx.db);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("seeds the persona, Sample + starter characters, adventure lorebooks, Creative preset, and settings", async () => {
    await seedSampleData(userId);

    const personas = listPersonas(holder.db);
    expect(personas).toHaveLength(1);
    expect(personas[0]!.name).toBe("Default");

    const chars = listCharacters(holder.db);
    const byId = new Map(chars.map((c) => [c.id, c]));
    expect(byId.get("starter-captain")?.name).toBe("Captain Jack Ryder");
    expect(byId.get("starter-scientist")?.name).toBe("Dr. Elena Vasquez");
    const sample = chars.find((c) => c.name === "Sample");
    expect(sample).toBeDefined();
    expect(sample!.data.first_mes).toBe("*Awaits your input*");

    const books = listLorebooks(holder.db);
    const byName = new Map(books.map((b) => [b.name, b]));
    const gazetteer = byName.get("Outer Rim Gazetteer");
    expect(gazetteer).toBeDefined();
    expect(gazetteer!.enabled).toBe(true);
    expect(gazetteer!.entryCount).toBeGreaterThan(0);
    const xenobiology = byName.get("Xenobiology of Themis");
    expect(xenobiology).toBeDefined();
    expect(xenobiology!.enabled).toBe(true);
    const entries = listEntries("starter-outer-rim", holder.db);
    expect(entries.map((e) => e.data.comment)).toContain("Nexus Station");

    const presets = listPresets(holder.db);
    const creative = presets.find((p) => p.name === "Creative");
    expect(creative).toBeDefined();

    const settings = getUserSettings(userId, holder.db)!;
    expect(settings.defaultPersonaId).toBe(personas[0]!.id);
    expect(settings.defaultPresetId).toBe(creative!.id);
    expect(settings.systemPrompt).toContain("{{char}}");
    expect(settings.postHistoryInstructions).toContain("{{user}}");
    expect(settings.impersonationPrompt).toContain("{{user}}");
    expect(settings.imagePromptExample).toBe(DEFAULT_IMAGE_PROMPT_EXAMPLE);
  });
});
