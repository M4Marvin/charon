import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { upsertUserSettings, getUserSettings } from "@/db/repositories/userSettings";
import { seedExistingDemoUsers } from "@/server/bootstrap";
import { DEFAULT_IMAGE_PROMPT_EXAMPLE } from "@/features/chat/generation/image-prompt";

describe("seedExistingDemoUsers backfill", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("backfills the default imagePromptExample when the field is null", async () => {
    const userId = seedTestUser(db, "demo-user");
    // Creates a settings row with all prompt fields null (imagePromptExample included).
    upsertUserSettings(userId, {}, db);
    expect(getUserSettings(userId, db)!.imagePromptExample).toBeNull();

    await seedExistingDemoUsers(db);

    expect(getUserSettings(userId, db)!.imagePromptExample).toBe(DEFAULT_IMAGE_PROMPT_EXAMPLE);
  });

  it("preserves a custom imagePromptExample during backfill", async () => {
    const userId = seedTestUser(db, "demo-user-custom");
    // Leave the other prompt fields null so the backfill condition still triggers.
    upsertUserSettings(userId, { imagePromptExample: "custom tags" }, db);
    expect(getUserSettings(userId, db)!.imagePromptExample).toBe("custom tags");

    await seedExistingDemoUsers(db);

    expect(getUserSettings(userId, db)!.imagePromptExample).toBe("custom tags");
  });
});
