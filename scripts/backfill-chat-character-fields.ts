// Backfill chat character fields from the associated character's data.
// Only updates chats where characterDescription is still NULL.
// Idempotent — safe to re-run.
//
// Run: tsx --env-file=.env.local scripts/backfill-chat-character-fields.ts

import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chats, characters } from "@/db/schema";

const stale = db
  .select({ id: chats.id, characterId: chats.characterId })
  .from(chats)
  .where(isNull(chats.characterDescription))
  .all();

if (stale.length === 0) {
  console.log("All chats already have character fields populated.");
  process.exit(0);
}

console.log(`Backfilling ${stale.length} chats...`);

let updated = 0;
let skipped = 0;

for (const chat of stale) {
  const char = db
    .select()
    .from(characters)
    .where(eq(characters.id, chat.characterId))
    .get();

  if (!char) {
    skipped++;
    continue;
  }

  db.update(chats)
    .set({
      characterDescription: char.data.description,
      characterPersonality: char.data.personality,
      characterScenario: char.data.scenario,
      characterSystemPrompt: char.data.system_prompt,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, chat.id))
    .run();

  updated++;
}

console.log(`Done. Updated ${updated}, skipped ${skipped} (character not found).`);
