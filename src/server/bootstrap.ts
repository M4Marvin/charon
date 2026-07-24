import { mkdir } from "node:fs/promises";
import { db } from "@/db";
import { characters as charactersTable, user, userSettings } from "@/db/schema";
import { eq, and, not, like } from "drizzle-orm";
import { seedDefaultBackgrounds, seedDemoCharactersForExistingUser } from "@/server/seed";
import { upsertUserSettings } from "@/db/repositories/userSettings";
import { ensureGlobalAiProviderExists } from "@/db/repositories/aiProviders";

export const FALLBACK_GLOBAL_PROVIDER = {
  name: "Built-in",
  baseUrl: "https://opencode.ai/zen/go/v1/",
  apiKey: "not-configured",
  defaultModel: null as string | null,
  defaultHeaders: null as Record<string, string> | null,
};

export async function ensureGlobalProvider(): Promise<void> {
  await mkdir("public/data/avatars", { recursive: true });
  await mkdir("public/data/backgrounds", { recursive: true });
  await ensureGlobalAiProviderExists(FALLBACK_GLOBAL_PROVIDER);
  await seedExistingDemoUsers();
  await seedDefaultBackgrounds();
}

async function seedExistingDemoUsers(): Promise<void> {
  const demoUsers = db
    .select({ id: user.id })
    .from(user)
    .where(not(eq(user.role, "admin")))
    .all();

  for (const u of demoUsers) {
    const hasDemoChar = db
      .select({ id: charactersTable.id })
      .from(charactersTable)
      .where(and(eq(charactersTable.userId, u.id), like(charactersTable.name, "Captain Jack%")))
      .get();

    if (!hasDemoChar) {
      seedDemoCharactersForExistingUser(u.id);
    }

    const settings = db.select().from(userSettings).where(eq(userSettings.userId, u.id)).get();
    if (settings) {
      if (
        settings.systemPrompt === null ||
        settings.postHistoryInstructions === null ||
        settings.impersonationPrompt === null
      ) {
        upsertUserSettings(u.id, {
          systemPrompt:
            settings.systemPrompt ??
            "You are a helpful AI assistant. Roleplay as {{char}} according to their character description, staying in character at all times. Write responses from {{char}}'s perspective in a narrative style, using *asterisks* for actions and descriptions.",
          postHistoryInstructions:
            settings.postHistoryInstructions ??
            "Stay in character and continue the scene naturally. React to {{user}}'s latest message and move the conversation forward.",
          impersonationPrompt:
            settings.impersonationPrompt ??
            "You are {{user}} for a single message only. Write a response as if you were {{user}} speaking to {{char}}. Stay in character for {{user}} based on the conversation so far.",
        });
      }

      if (settings.defaultSelectedModel !== null) {
        upsertUserSettings(u.id, { defaultSelectedModel: null });
      }
    }
  }
}
