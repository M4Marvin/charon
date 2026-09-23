// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

import type { CharacterDetail } from "@/db/repositories/characters";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { CharacterPoster } from "./character-poster";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

function makeCharacter(imagePath: string | null): CharacterDetail {
  return {
    id: "char-1",
    name: "Zephyr",
    data: makeCharacterData({ name: "Zephyr" }),
    spec: "chara_card_v2",
    specVersion: "2.0",
    imagePath,
    tagline: null,
    creator: "tester",
    creatorNotes: "",
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date(),
    chatCount: 2,
    userMessageCount: 2,
    messageCount: 5,
  };
}

describe("CharacterPoster", () => {
  it("renders a visible initial fallback and the chat CTA when there is no image", () => {
    render(
      <CharacterPoster
        character={makeCharacter(null)}
        chats={[]}
        onStartChat={vi.fn()}
        starting={false}
      />,
    );

    const initial = screen.getByText("Z");
    expect(initial.parentElement?.classList.contains("hidden")).toBe(false);
    expect(screen.getByText("Chat with Zephyr")).toBeTruthy();
  });

  it("reveals the hidden fallback sibling when the portrait image errors", () => {
    render(
      <CharacterPoster
        character={makeCharacter("uploads/avatars/abc.png")}
        chats={[]}
        onStartChat={vi.fn()}
        starting={false}
      />,
    );

    const img = screen.getByAltText("Zephyr") as HTMLImageElement;
    const fallback = img.nextElementSibling as HTMLElement | null;

    expect(img.getAttribute("srcset")).toContain("v=abc.png");
    expect(img.getAttribute("srcset")).toContain("w=320&q=80");
    expect(fallback).not.toBeNull();
    expect(fallback?.classList.contains("hidden")).toBe(true);
    expect(fallback?.textContent).toBe("Z");

    fireEvent.error(img);

    expect(fallback?.classList.contains("hidden")).toBe(false);
  });
});
