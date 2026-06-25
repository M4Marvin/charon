import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "./helpers";
import { aiProviders, presets } from "@/db/schema";
import {
  getUserSettings,
  upsertUserSettings,
} from "@/db/repositories/userSettings";

function seedProvider(db: TestDb, userId: string, id = "prov-1") {
  const now = new Date();
  db.insert(aiProviders)
    .values({
      id,
      userId,
      name: "Test Provider",
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function seedPreset(db: TestDb, userId: string, id = "preset-1") {
  const now = new Date();
  db.insert(presets)
    .values({
      id,
      userId,
      name: "Test Preset",
      data: {},
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

describe("userSettings repo", () => {
  let db: TestDb;
  let userId: string;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    seedProvider(db, userId);
    seedPreset(db, userId);
  });

  it("returns null for a user with no settings row yet", () => {
    expect(getUserSettings(userId, db)).toBeNull();
  });

  it("inserts a row on first upsert", () => {
    const row = upsertUserSettings(userId, { defaultProviderId: "prov-1" }, db);
    expect(row.userId).toBe(userId);
    expect(row.defaultProviderId).toBe("prov-1");
    expect(row.defaultPresetId).toBeNull();
    expect(row.defaultSelectedModel).toBeNull();
  });

  it("applies partial updates without overwriting untouched fields", () => {
    upsertUserSettings(
      userId,
      {
        defaultProviderId: "prov-1",
        defaultPresetId: "preset-1",
        defaultSelectedModel: "gpt-4o",
      },
      db,
    );
    // Only update the model; provider + preset should survive.
    upsertUserSettings(userId, { defaultSelectedModel: "gpt-4o-mini" }, db);
    const row = getUserSettings(userId, db);
    expect(row).not.toBeNull();
    expect(row!.defaultProviderId).toBe("prov-1");
    expect(row!.defaultPresetId).toBe("preset-1");
    expect(row!.defaultSelectedModel).toBe("gpt-4o-mini");
  });

  it("clears a field when explicitly set to null", () => {
    upsertUserSettings(userId, { defaultProviderId: "prov-1" }, db);
    upsertUserSettings(userId, { defaultProviderId: null }, db);
    const row = getUserSettings(userId, db);
    expect(row!.defaultProviderId).toBeNull();
  });

  it("is a no-op when all patch fields are undefined", () => {
    const before = upsertUserSettings(userId, { defaultProviderId: "prov-1" }, db);
    const after = upsertUserSettings(userId, {}, db);
    expect(after.defaultProviderId).toBe("prov-1");
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });
});
