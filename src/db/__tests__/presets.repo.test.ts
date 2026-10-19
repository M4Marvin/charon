import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb, type TestSqlite } from "./helpers";
import { createPreset, deletePresetAndRepair, getPreset } from "@/db/repositories/presets";
import { getUserSettings, upsertUserSettings } from "@/db/repositories/userSettings";

describe("presets repo", () => {
  let db: TestDb;
  let sqlite: TestSqlite;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("stores a preset without a provider or model", () => {
    const row = createPreset({ id: "preset-1", name: "Sparse", data: { temperature: 1 } }, db);
    expect(row.providerId).toBeNull();
    expect(row.model).toBeNull();
    expect(getPreset("preset-1", db).data).toEqual({ temperature: 1 });
  });

  it("clears the default preset when the default is deleted", () => {
    const userId = seedTestUser(db);
    createPreset({ id: "preset-1", name: "Main", data: {} }, db);
    upsertUserSettings(userId, { defaultPresetId: "preset-1" }, db);

    const result = deletePresetAndRepair("preset-1", db);

    expect(result.wasDefault).toBe(true);
    expect(() => getPreset("preset-1", db)).toThrow("Preset not found");
    expect(getUserSettings(userId, db)?.defaultPresetId).toBeNull();
  });

  it("leaves the default preset alone when another is deleted", () => {
    const userId = seedTestUser(db);
    createPreset({ id: "preset-1", name: "Main", data: {} }, db);
    createPreset({ id: "preset-2", name: "Other", data: {} }, db);
    upsertUserSettings(userId, { defaultPresetId: "preset-1" }, db);

    const result = deletePresetAndRepair("preset-2", db);

    expect(result.wasDefault).toBe(false);
    expect(getUserSettings(userId, db)?.defaultPresetId).toBe("preset-1");
  });

  it("throws for a missing preset", () => {
    expect(() => deletePresetAndRepair("missing", db)).toThrow("Preset not found");
  });
});
