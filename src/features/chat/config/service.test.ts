import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { backgrounds, characters, chats, personas, userSettings } from "@/db/schema";
import { createChat } from "../tree/service";
import { loadChatConfig } from "./service";

describe("loadChatConfig", () => {
  let db: TestDb;
  let userId: string;
  let chatId: string;

  let ctx: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    const data = makeCharacterData();
    db.insert(characters)
      .values({
        id: "char-1",
        name: data.name,
        data,
        spec: "chara_card_v2",
        specVersion: "2.0",
        imagePath: "uploads/avatars/a.png",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    chatId = createChat({ characterId: "char-1", title: "Test", greetings: ["Hello!"] }, db).id;
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("exposes character, persona and background image data", async () => {
    db.insert(personas)
      .values({
        id: "persona-1",
        name: "PersonaName",
        description: "Persona desc",
        iconPath: "uploads/personas/p.png",
      })
      .run();
    db.insert(userSettings).values({ userId, defaultPersonaId: "persona-1" }).run();
    db.insert(backgrounds)
      .values({ id: "bg-1", name: "Background", path: "uploads/backgrounds/b.png" })
      .run();
    db.update(chats).set({ backgroundId: "bg-1" }).where(eq(chats.id, chatId)).run();

    const config = await loadChatConfig(userId, chatId, "Fallback", db);

    expect(config.characterImagePath).toBe("uploads/avatars/a.png");
    expect(config.personaId).toBe("persona-1");
    expect(config.personaIconPath).toBe("uploads/personas/p.png");
    expect(config.backgroundPath).toBe("uploads/backgrounds/b.png");
    expect(config.persona).toEqual({
      id: "persona-1",
      name: "PersonaName",
      description: "Persona desc",
      iconPath: "uploads/personas/p.png",
    });
  });

  it("returns nulls and the fallback persona name without persona or background", async () => {
    const config = await loadChatConfig(userId, chatId, "Fallback", db);

    expect(config.characterImagePath).toBe("uploads/avatars/a.png");
    expect(config.personaId).toBeNull();
    expect(config.personaIconPath).toBeNull();
    expect(config.backgroundPath).toBeNull();
    expect(config.persona).toEqual({ name: "Fallback" });
  });
});
