import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, type TestDb, type TestSqlite } from "./helpers";
import {
  createAiProvider,
  deleteAiProvider,
  deleteAiProviderAndRepair,
  getAiProvider,
  listAiProviders,
  updateAiProvider,
} from "@/db/repositories/aiProviders";
import { getUserSettings, upsertUserSettings } from "@/db/repositories/userSettings";
import { seedTestUser } from "./helpers";

describe("aiProviders repo", () => {
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

  it("throws on get for a missing provider", async () => {
    await expect(getAiProvider("missing", db)).rejects.toThrow("Provider not found");
  });

  it("creates a provider and round-trips the decrypted api key", async () => {
    await createAiProvider(
      {
        id: "prov-1",
        name: "OpenAI",
        baseUrl: "https://api.example/v1",
        apiKey: "secret-key",
        defaultModel: "gpt-4o",
        defaultHeaders: { "X-Test": "1" },
      },
      db,
    );

    const provider = await getAiProvider("prov-1", db);
    expect(provider.id).toBe("prov-1");
    expect(provider.name).toBe("OpenAI");
    expect(provider.baseUrl).toBe("https://api.example/v1");
    expect(provider.apiKey).toBe("secret-key");
    expect(provider.defaultModel).toBe("gpt-4o");
    expect(provider.defaultHeaders).toEqual({ "X-Test": "1" });
  });

  it("defaults optional fields to null", async () => {
    await createAiProvider(
      { id: "prov-1", name: "Bare", baseUrl: "https://a.example/v1", apiKey: "k" },
      db,
    );
    const provider = await getAiProvider("prov-1", db);
    expect(provider.defaultModel).toBeNull();
    expect(provider.defaultHeaders).toBeNull();
  });

  it("lists providers ordered by name", async () => {
    await createAiProvider(
      { id: "prov-1", name: "Zeta", baseUrl: "https://z.example/v1", apiKey: "k" },
      db,
    );
    await createAiProvider(
      { id: "prov-2", name: "Alpha", baseUrl: "https://a.example/v1", apiKey: "k" },
      db,
    );
    const list = await listAiProviders(db);
    expect(list.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("updates only the provided fields", async () => {
    await createAiProvider(
      {
        id: "prov-1",
        name: "Old",
        baseUrl: "https://old.example/v1",
        apiKey: "old-key",
        defaultModel: "old-model",
      },
      db,
    );

    const updated = await updateAiProvider("prov-1", { name: "New", apiKey: "new-key" }, db);
    expect(updated.name).toBe("New");
    expect(updated.apiKey).toBe("new-key");
    expect(updated.baseUrl).toBe("https://old.example/v1");
    expect(updated.defaultModel).toBe("old-model");
  });

  it("throws when updating a missing provider", async () => {
    await expect(updateAiProvider("missing", { name: "X" }, db)).rejects.toThrow(
      "Provider not found",
    );
  });

  it("deletes a provider", async () => {
    await createAiProvider(
      { id: "prov-1", name: "Doomed", baseUrl: "https://a.example/v1", apiKey: "k" },
      db,
    );
    await deleteAiProvider("prov-1", db);
    await expect(getAiProvider("prov-1", db)).rejects.toThrow("Provider not found");
  });

  it("throws when deleting a missing provider", async () => {
    await expect(deleteAiProvider("missing", db)).rejects.toThrow("Provider not found");
  });

  it("enforces unique provider names on create", async () => {
    await createAiProvider(
      { id: "prov-1", name: "Duplicate", baseUrl: "https://a.example/v1", apiKey: "k" },
      db,
    );
    await expect(
      createAiProvider(
        { id: "prov-2", name: "Duplicate", baseUrl: "https://b.example/v1", apiKey: "k" },
        db,
      ),
    ).rejects.toThrow();
  });

  it("enforces unique provider names on update", async () => {
    await createAiProvider(
      { id: "prov-1", name: "Taken", baseUrl: "https://a.example/v1", apiKey: "k" },
      db,
    );
    await createAiProvider(
      { id: "prov-2", name: "Other", baseUrl: "https://b.example/v1", apiKey: "k" },
      db,
    );
    await expect(updateAiProvider("prov-2", { name: "Taken" }, db)).rejects.toThrow();
  });

  describe("deleteAiProviderAndRepair", () => {
    it("clears the default provider and stale model when the default is deleted", async () => {
      const userId = seedTestUser(db);
      await createAiProvider(
        { id: "prov-1", name: "Main", baseUrl: "https://a.example/v1", apiKey: "k" },
        db,
      );
      await createAiProvider(
        { id: "prov-2", name: "Other", baseUrl: "https://b.example/v1", apiKey: "k" },
        db,
      );
      upsertUserSettings(
        userId,
        {
          defaultProviderId: "prov-1",
          defaultSelectedModel: "stale-model",
        },
        db,
      );

      const result = deleteAiProviderAndRepair("prov-1", db);

      expect(result.wasDefault).toBe(true);
      await expect(getAiProvider("prov-1", db)).rejects.toThrow("Provider not found");
      const settings = getUserSettings(userId, db)!;
      expect(settings.defaultProviderId).toBeNull();
      expect(settings.defaultSelectedModel).toBeNull();
      await expect(getAiProvider("prov-2", db)).resolves.toMatchObject({ name: "Other" });
    });

    it("leaves defaults untouched when a non-default provider is deleted", async () => {
      const userId = seedTestUser(db);
      await createAiProvider(
        { id: "prov-1", name: "Main", baseUrl: "https://a.example/v1", apiKey: "k" },
        db,
      );
      await createAiProvider(
        { id: "prov-2", name: "Other", baseUrl: "https://b.example/v1", apiKey: "k" },
        db,
      );
      upsertUserSettings(
        userId,
        { defaultProviderId: "prov-1", defaultSelectedModel: "keep-me" },
        db,
      );

      const result = deleteAiProviderAndRepair("prov-2", db);

      expect(result.wasDefault).toBe(false);
      const settings = getUserSettings(userId, db)!;
      expect(settings.defaultProviderId).toBe("prov-1");
      expect(settings.defaultSelectedModel).toBe("keep-me");
    });

    it("throws for a missing provider without touching defaults", async () => {
      const userId = seedTestUser(db);
      upsertUserSettings(userId, { defaultSelectedModel: "keep-me" }, db);

      expect(() => deleteAiProviderAndRepair("missing", db)).toThrow("Provider not found");
      expect(getUserSettings(userId, db)?.defaultSelectedModel).toBe("keep-me");
    });
  });
});
