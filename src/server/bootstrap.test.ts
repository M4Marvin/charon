import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";

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
  realpath: vi.fn(async (path: string) => resolve(path)),
  lstat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => true })),
  open: vi.fn(async () => ({
    stat: vi.fn(async () => ({ isFile: () => true, size: 0 })),
    close: vi.fn(async () => {}),
  })),
}));

vi.mock("@/server/uploads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/uploads")>()),
  readPrivateFile: vi.fn(async () => Buffer.from("image")),
  readPrivateDirectory: vi.fn(async () => [
    { name: "one.jpg", isFile: () => true },
    { name: "two.png", isFile: () => true },
  ]),
  writePrivateFileAtomic: vi.fn(async () => {}),
}));

import { ensureStartupTasks } from "@/server/bootstrap";
import { seedSampleData } from "@/server/seed";
import { listBackgrounds } from "@/db/repositories/backgrounds";
import { listCharacters } from "@/db/repositories/characters";
import { listEntries, listLorebooks } from "@/db/repositories/lorebooks";
import { listPersonas } from "@/db/repositories/personas";
import { listPresets } from "@/db/repositories/presets";
import { getUserSettings } from "@/db/repositories/userSettings";
import { readPrivateDirectory } from "@/server/uploads";

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
    expect(readPrivateDirectory as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);

    const bgs = listBackgrounds(holder.db);
    expect(bgs).toHaveLength(2);
    expect(bgs.map((b) => b.name).sort()).toEqual(["One", "Two"]);
  });

  it("is idempotent: a second run seeds nothing new", async () => {
    await ensureStartupTasks();
    const seeded = listBackgrounds(holder.db).length;

    await ensureStartupTasks();

    expect(listBackgrounds(holder.db)).toHaveLength(seeded);
    expect(readPrivateDirectory as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
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

  it("seeds the persona, three portrait-ready starters, Harborlight lore, Creative preset, and settings", async () => {
    await seedSampleData(userId);

    const personas = listPersonas(holder.db);
    expect(personas).toHaveLength(1);
    expect(personas[0]!.name).toBe("Default");

    const chars = listCharacters(holder.db);
    expect(chars).toHaveLength(3);
    const byId = new Map(chars.map((c) => [c.id, c]));
    expect(byId.get("starter-ferryman")?.name).toBe("Captain Elias Thorne");
    expect(byId.get("starter-naturalist")?.name).toBe("Dr. Margaret Finch");
    expect(byId.get("starter-storyteller")?.name).toBe("Lucien Vane");

    const books = listLorebooks(holder.db);
    const byName = new Map(books.map((b) => [b.name, b]));
    const almanac = byName.get("The Harborlight Almanac");
    expect(almanac).toBeDefined();
    expect(almanac!.enabled).toBe(true);
    expect(almanac!.entryCount).toBeGreaterThan(0);
    const entries = listEntries("starter-harborlight", holder.db);
    expect(entries.map((e) => e.data.comment)).toContain("Harborlight");

    const presets = listPresets(holder.db);
    const creative = presets.find((p) => p.name === "Creative");
    expect(creative).toBeDefined();

    const settings = getUserSettings(userId, holder.db)!;
    expect(settings.defaultPersonaId).toBe(personas[0]!.id);
    expect(settings.defaultPresetId).toBe(creative!.id);
    expect(settings.systemPrompt).toContain("{{char}}");
    expect(settings.postHistoryInstructions).toContain("{{user}}");
    expect(settings.impersonationPrompt).toContain("{{user}}");
  });
});
