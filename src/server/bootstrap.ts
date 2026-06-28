import { db } from "@/db";
import { upsertGlobalAiProvider } from "@/db/repositories/aiProviders";
import { characters as charactersTable, user, userSettings } from "@/db/schema";
import { eq, and, not, like } from "drizzle-orm";
import { seedDefaultBackgrounds, seedDemoCharactersForExistingUser } from "@/server/seed";
import { upsertUserSettings } from "@/db/repositories/userSettings";

export async function ensureGlobalProvider(): Promise<void> {
  await upsertGlobalAiProvider({
    name: "Built-in",
    baseUrl: process.env.AI_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: process.env.AI_API_KEY ?? "",
    defaultModel: process.env.AI_DEFAULT_MODEL ?? "llama3.2",
  });

  await seedExistingDemoUsers();
  await seedDefaultBackgrounds();
}

async function seedExistingDemoUsers(): Promise<void> {
  const demoUsers = db.select({ id: user.id }).from(user).where(not(eq(user.username, "marv"))).all();

  for (const u of demoUsers) {
    const hasDemoChar = db
      .select({ id: charactersTable.id })
      .from(charactersTable)
      .where(
        and(
          eq(charactersTable.userId, u.id),
          like(charactersTable.name, "Captain Jack%"),
        ),
      )
      .get();

    if (!hasDemoChar) {
      seedDemoCharactersForExistingUser(u.id);
    }

    const settings = db.select().from(userSettings).where(eq(userSettings.userId, u.id)).get();
    if (settings && (settings.systemPrompt === null || settings.postHistoryInstructions === null || settings.impersonationPrompt === null)) {
      upsertUserSettings(u.id, {
        systemPrompt: settings.systemPrompt ?? "You are a helpful AI assistant. Roleplay as {{char}} according to their character description, staying in character at all times. Write responses from {{char}}'s perspective in a narrative style, using *asterisks* for actions and descriptions.",
        postHistoryInstructions: settings.postHistoryInstructions ?? "Stay in character and continue the scene naturally. React to {{user}}'s latest message and move the conversation forward.",
        impersonationPrompt: settings.impersonationPrompt ?? "You are {{user}} for a single message only. Write a response as if you were {{user}} speaking to {{char}}. Stay in character for {{user}} based on the conversation so far.",
      });
    }
  }
}
