import { db as defaultDb, type DB } from "@/db";
import { getUserSettings } from "@/db/repositories/userSettings";
import { getPersona } from "@/db/repositories/personas";
import type { PersonaInfo } from "./types";

export function resolvePersona(
  userId: string,
  fallbackName: string,
  db: DB = defaultDb,
): PersonaInfo {
  try {
    const settings = getUserSettings(userId, db);
    if (settings?.defaultPersonaId) {
      try {
        const persona = getPersona(userId, settings.defaultPersonaId, db);
        return {
          name: persona.name,
          description: persona.description ?? undefined,
        };
      } catch {
        // persona deleted — fall through to fallback
      }
    }
  } catch {
    // no settings — fall through to fallback
  }
  return { name: fallbackName };
}
