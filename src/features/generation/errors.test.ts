import { describe, expect, it } from "vitest";
import {
  ChatBusyError,
  ConfigError,
  ContextOverflowError,
  isGenerationError,
  httpStatusFor,
  toErrorBody,
} from "./errors";

describe("generation error mapping", () => {
  it("recognizes tagged generation errors only", () => {
    expect(
      isGenerationError(
        new ChatBusyError({
          message: "busy",
          chatId: "c1",
          activeJobId: "j1",
        }),
      ),
    ).toBe(true);
    expect(isGenerationError(new Error("plain"))).toBe(false);
    expect(isGenerationError({ _tag: "toString" })).toBe(false);
  });

  it("maps tags to HTTP status and stable codes", () => {
    const overflow = new ContextOverflowError({
      message: "too long",
      estimatedTokens: 10,
      contextWindow: 5,
    });
    expect(httpStatusFor(overflow)).toBe(413);
    expect(toErrorBody(overflow)).toEqual({ code: "context_overflow", message: "too long" });

    const busy = new ChatBusyError({
      message: "already running",
      chatId: "c1",
      activeJobId: "j1",
    });
    expect(httpStatusFor(busy)).toBe(409);
    expect(toErrorBody(busy).code).toBe("busy");

    expect(httpStatusFor(new ConfigError({ message: "bad config" }))).toBe(422);
  });
});
