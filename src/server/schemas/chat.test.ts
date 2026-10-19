import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { UpdateChatSettings, UpdateUserSettings } from "./chat";

function decodeChat(input: unknown) {
  return Schema.decodeUnknownSync(UpdateChatSettings)(input);
}

function decodeUser(input: unknown) {
  return Schema.decodeUnknownSync(UpdateUserSettings)(input);
}

describe("UpdateChatSettings schema", () => {
  it("accepts a partial payload with only the id", () => {
    expect(decodeChat({ id: "chat-1" })).toEqual({ id: "chat-1" });
  });

  it("accepts a partial title-only payload", () => {
    const decoded = decodeChat({ id: "chat-1", title: "Renamed" });
    expect(decoded.title).toBe("Renamed");
    expect(decoded.characterDescription).toBeUndefined();
    expect(decoded.backgroundId).toBeUndefined();
  });

  it("accepts explicit nulls for cleared fields", () => {
    const decoded = decodeChat({
      id: "chat-1",
      characterDescription: null,
      backgroundId: null,
    });
    expect(decoded.characterDescription).toBeNull();
    expect(decoded.backgroundId).toBeNull();
  });

  it("still requires the id", () => {
    expect(() => decodeChat({ title: "Renamed" })).toThrow();
  });

  it("rejects non-string values", () => {
    expect(() => decodeChat({ id: "chat-1", title: 42 })).toThrow();
  });
});

describe("UpdateUserSettings schema", () => {
  it("accepts an empty partial payload", () => {
    expect(decodeUser({})).toEqual({});
  });

  it("accepts a single field", () => {
    const decoded = decodeUser({ systemPrompt: "Hello" });
    expect(decoded.systemPrompt).toBe("Hello");
    expect(decoded.defaultProviderId).toBeUndefined();
  });

  it("accepts explicit nulls", () => {
    const decoded = decodeUser({ defaultPersonaId: null, impersonationPrompt: null });
    expect(decoded.defaultPersonaId).toBeNull();
    expect(decoded.impersonationPrompt).toBeNull();
  });
});
