import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "./helpers";
import { aiProviders, personas, presets } from "@/db/schema";
import { getUserSettings, upsertUserSettings } from "@/db/repositories/userSettings";

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

function seedPersona(db: TestDb, userId: string, id = "persona-1") {
  const now = new Date();
  db.insert(personas)
    .values({
      id,
      userId,
      name: "Test Persona",
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
    seedPersona(db, userId);
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
    expect(row.defaultPersonaId).toBeNull();
    expect(row.systemPrompt).toBeNull();
    expect(row.postHistoryInstructions).toBeNull();
    expect(row.impersonationPrompt).toBeNull();
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

  // ── New fields: defaultPersonaId, systemPrompt, postHistoryInstructions, impersonationPrompt ──

  it("stores and retrieves the new prompt + persona fields on first upsert", () => {
    const row = upsertUserSettings(
      userId,
      {
        defaultPersonaId: "persona-1",
        systemPrompt: "You are helpful.",
        postHistoryInstructions: "[System note: this is a test.]",
        impersonationPrompt: "Write as the user:",
      },
      db,
    );
    expect(row.defaultPersonaId).toBe("persona-1");
    expect(row.systemPrompt).toBe("You are helpful.");
    expect(row.postHistoryInstructions).toBe("[System note: this is a test.]");
    expect(row.impersonationPrompt).toBe("Write as the user:");
  });

  it("partial updates of the new fields leave the others untouched", () => {
    upsertUserSettings(
      userId,
      {
        defaultPersonaId: "persona-1",
        systemPrompt: "First prompt",
        postHistoryInstructions: "First post",
        impersonationPrompt: "First impersonation",
      },
      db,
    );
    // Only update systemPrompt.
    upsertUserSettings(userId, { systemPrompt: "Second prompt" }, db);
    const row = getUserSettings(userId, db);
    expect(row!.defaultPersonaId).toBe("persona-1");
    expect(row!.systemPrompt).toBe("Second prompt");
    expect(row!.postHistoryInstructions).toBe("First post");
    expect(row!.impersonationPrompt).toBe("First impersonation");
  });

  it("clears the new prompt fields when explicitly set to null", () => {
    upsertUserSettings(
      userId,
      {
        systemPrompt: "Temp",
        postHistoryInstructions: "Temp",
        impersonationPrompt: "Temp",
        defaultPersonaId: "persona-1",
      },
      db,
    );
    upsertUserSettings(
      userId,
      {
        systemPrompt: null,
        postHistoryInstructions: null,
        impersonationPrompt: null,
        defaultPersonaId: null,
      },
      db,
    );
    const row = getUserSettings(userId, db);
    expect(row!.systemPrompt).toBeNull();
    expect(row!.postHistoryInstructions).toBeNull();
    expect(row!.impersonationPrompt).toBeNull();
    expect(row!.defaultPersonaId).toBeNull();
  });
});
