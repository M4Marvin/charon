import { eq } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { userSettings, type UserSettings } from "@/db/schema";

export type UserSettingsPatch = Partial<
  Pick<UserSettings, "defaultProviderId" | "defaultPresetId" | "defaultSelectedModel">
>;

export function getUserSettings(
  userId: string,
  db: DB = defaultDb,
): UserSettings | null {
  const row = db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  return row ?? null;
}

// Insert on first call, then apply partial updates. Fields set to `undefined`
// are left untouched (matches the partial-patch convention used by `updateChat`).
export function upsertUserSettings(
  userId: string,
  patch: UserSettingsPatch,
  db: DB = defaultDb,
): UserSettings {
  const existing = getUserSettings(userId, db);
  if (!existing) {
    const row = db
      .insert(userSettings)
      .values({
        userId,
        defaultProviderId: patch.defaultProviderId ?? null,
        defaultPresetId: patch.defaultPresetId ?? null,
        defaultSelectedModel: patch.defaultSelectedModel ?? null,
      })
      .returning()
      .get();
    return row;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.defaultProviderId !== undefined) updates.defaultProviderId = patch.defaultProviderId;
  if (patch.defaultPresetId !== undefined) updates.defaultPresetId = patch.defaultPresetId;
  if (patch.defaultSelectedModel !== undefined) updates.defaultSelectedModel = patch.defaultSelectedModel;
  if (Object.keys(updates).length === 1) return existing;
  const row = db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.userId, userId))
    .returning()
    .get();
  if (!row) throw new Error("User settings not found");
  return row;
}
