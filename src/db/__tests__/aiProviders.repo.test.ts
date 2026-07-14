import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, type TestDb } from "./helpers";
import {
  ensureGlobalAiProviderExists,
  getGlobalAiProvider,
  upsertGlobalAiProvider,
} from "@/db/repositories/aiProviders";

const FALLBACK = {
  name: "Built-in",
  baseUrl: "https://local-test.example/v1",
  apiKey: "placeholder-key",
  defaultModel: null as string | null,
  defaultHeaders: null as Record<string, string> | null,
};

describe("ensureGlobalAiProviderExists", () => {
  let db: TestDb;

  beforeEach(() => {
    db = makeTestDb().db;
  });

  it("inserts a global provider when none exists", async () => {
    await ensureGlobalAiProviderExists(FALLBACK, db);

    const provider = await getGlobalAiProvider(db);
    expect(provider.name).toBe(FALLBACK.name);
    expect(provider.baseUrl).toBe(FALLBACK.baseUrl);
    expect(provider.apiKey).toBe(FALLBACK.apiKey);
    expect(provider.defaultModel).toBeNull();
    expect(provider.defaultHeaders).toBeNull();
    expect(provider.userId).toBeNull();
  });

  it("is a no-op when a global provider already exists", async () => {
    await ensureGlobalAiProviderExists(FALLBACK, db);
    const first = await getGlobalAiProvider(db);

    await ensureGlobalAiProviderExists({ ...FALLBACK, name: "Should Not Be Set" }, db);
    const second = await getGlobalAiProvider(db);

    expect(second.name).toBe(first.name);
    expect(second.baseUrl).toBe(first.baseUrl);
    expect(second.apiKey).toBe(first.apiKey);
  });

  it("does not overwrite admin-configured values", async () => {
    await upsertGlobalAiProvider(
      {
        name: "Real Provider",
        baseUrl: "https://real.example/v1",
        apiKey: "real-api-key",
        defaultModel: "real-model",
      },
      db,
    );

    await ensureGlobalAiProviderExists(FALLBACK, db);

    const provider = await getGlobalAiProvider(db);
    expect(provider.name).toBe("Real Provider");
    expect(provider.baseUrl).toBe("https://real.example/v1");
    expect(provider.apiKey).toBe("real-api-key");
    expect(provider.defaultModel).toBe("real-model");
  });
});
