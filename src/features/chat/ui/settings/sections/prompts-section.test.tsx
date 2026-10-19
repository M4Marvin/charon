// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

// No vitest setup file / globals in this repo, so RTL auto-cleanup never runs.
afterEach(cleanup);

const mockMutate = vi.fn();

vi.mock("@/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    data: {
      systemPrompt: "default system",
      postHistoryInstructions: "default post-history",
      impersonationPrompt: "default impersonation",
    },
  }),
  useUpdateUserSettings: () => ({ mutate: mockMutate }),
}));

import { PromptsSection } from "./prompts-section";

describe("PromptsSection", () => {
  it("still renders and commits the impersonation prompt (regression)", () => {
    const { container } = render(<PromptsSection chatId="c1" isStreaming={false} />);

    const textarea = container.querySelector("#ps-impersonate");
    expect(textarea).not.toBeNull();

    fireEvent.change(textarea as HTMLElement, { target: { value: "you are my persona" } });
    fireEvent.blur(textarea as HTMLElement);

    expect(mockMutate).toHaveBeenCalledWith({ impersonationPrompt: "you are my persona" });
  });
});
