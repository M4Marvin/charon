import { randomUUID } from "node:crypto";
import {
  createLorebook as repoCreate,
  createEntry as repoCreateEntry,
} from "@/db/repositories/lorebooks";
import { parseWorldFile } from "@/lib/lorebook/world-file";

export async function importWorldFile(
  content: string,
  userId: string,
): Promise<{
  id: string;
  name: string;
  entriesInserted: number;
  entriesSkipped: number;
}> {
  const parsed = parseWorldFile(content);

  const id = randomUUID();
  repoCreate({
    id,
    userId,
    name: parsed.name,
    description: parsed.description,
    config: parsed.config,
  });

  let entriesInserted = 0;
  for (const entry of parsed.entries) {
    try {
      repoCreateEntry(userId, {
        id: randomUUID(),
        lorebookId: id,
        uid: entry.uid,
        data: entry,
      });
      entriesInserted++;
    } catch {
      // (lorebookId, uid) collision — skip this entry.
    }
  }

  return {
    id,
    name: parsed.name,
    entriesInserted,
    entriesSkipped: parsed.entriesSkipped,
  };
}
