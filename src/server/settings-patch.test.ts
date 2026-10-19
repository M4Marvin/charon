import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Schema } from "effect";
import { UpdateChatSettings, UpdateUserSettings } from "@/server/schemas/chat";
import { toChatSettingsPatch, toUserSettingsPatch } from "@/server/settings-patch";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { characters } from "@/db/schema";
import {
  createChat as repoCreateChat,
  getChat as repoGetChat,
  updateChat as repoUpdateChat,
} from "@/db/repositories/chats";
import { getUserSettings, upsertUserSettings } from "@/db/repositories/userSettings";

const decodeChat = (input: unknown) => Schema.decodeUnknownSync(UpdateChatSettings)(input);
const decodeUser = (input: unknown) => Schema.decodeUnknownSync(UpdateUserSettings)(input);

describe("settings patch mapping", () => {
  it("keeps absent chat fields absent and clears nulls", () => {
    expect(toChatSettingsPatch(decodeChat({ id: "chat-1" }))).toEqual({});
    expect(toChatSettingsPatch(decodeChat({ id: "chat-1", title: "Renamed" }))).toEqual({
      title: "Renamed",
    });
    expect(
      toChatSettingsPatch(decodeChat({ id: "chat-1", backgroundId: null })).backgroundId,
    ).toBeNull();
  });

  it("keeps absent user fields absent", () => {
    expect(toUserSettingsPatch(decodeUser({}))).toEqual({});
    expect(toUserSettingsPatch(decodeUser({ systemPrompt: "Hello" }))).toEqual({
      systemPrompt: "Hello",
    });
  });
});

describe("settings round-trip", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;
  let userId: string;
  let characterId: string;

  beforeEach(() => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    characterId = "char-1";
    const data = makeCharacterData();
    db.insert(characters)
      .values({
        id: characterId,
        name: data.name,
        data,
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("persists a title-only patch without touching overrides", () => {
    repoCreateChat({ id: "chat-1", characterId, title: "Original" }, db);
    repoUpdateChat(
      "chat-1",
      {
        characterDescription: "Keep me",
        characterPersonality: "Personality",
        characterScenario: "Scenario",
        characterSystemPrompt: "System",
      },
      db,
    );

    const decoded = decodeChat({ id: "chat-1", title: "Renamed" });
    repoUpdateChat(decoded.id, toChatSettingsPatch(decoded), db);

    const chat = repoGetChat("chat-1", db);
    expect(chat.title).toBe("Renamed");
    expect(chat.characterDescription).toBe("Keep me");
    expect(chat.characterPersonality).toBe("Personality");
    expect(chat.characterScenario).toBe("Scenario");
    expect(chat.characterSystemPrompt).toBe("System");
  });

  it("persists a single user-settings field without resetting the others", () => {
    upsertUserSettings(
      userId,
      { systemPrompt: "Original prompt", impersonationPrompt: "Keep me" },
      db,
    );

    const decoded = decodeUser({ postHistoryInstructions: "Added later" });
    upsertUserSettings(userId, toUserSettingsPatch(decoded), db);

    const row = getUserSettings(userId, db)!;
    expect(row.systemPrompt).toBe("Original prompt");
    expect(row.impersonationPrompt).toBe("Keep me");
    expect(row.postHistoryInstructions).toBe("Added later");
  });
});
