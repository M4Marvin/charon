// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RelativeTime } from "./RelativeTime";

afterEach(cleanup);

const now = new Date("2026-10-19T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("RelativeTime compact", () => {
  it.each([
    [10_000, "now"],
    [60_000, "1m"],
    [2 * 60 * 60 * 1000, "2h"],
    [3 * 24 * 60 * 60 * 1000, "3d"],
  ])("formats %i ms as %s", (ms, expected) => {
    render(<RelativeTime date={ago(ms)} now={now} compact />);

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("keeps the full phrase in the title", () => {
    render(<RelativeTime date={ago(2 * 60 * 60 * 1000)} now={now} compact />);

    expect(screen.getByTitle("about 2 hours ago")).toBeTruthy();
  });
});
