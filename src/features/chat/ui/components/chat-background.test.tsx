// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ChatBackground } from "./chat-background";

afterEach(cleanup);

describe("ChatBackground", () => {
  it("requests a responsive, versioned background variant", () => {
    const { container } = render(
      <ChatBackground
        src="/api/backgrounds/background-1/image?v=background.png"
        fallbackSrc={null}
      />,
    );

    const image = container.querySelector("img");
    expect(image?.getAttribute("srcset")).toContain("v=background.png");
    expect(image?.getAttribute("srcset")).toContain("w=1280&q=80");
    expect(image?.getAttribute("sizes")).toBe("100vw");
    expect(image?.getAttribute("loading")).toBe("eager");
    expect(image?.hasAttribute("width")).toBe(false);
    expect(image?.hasAttribute("height")).toBe(false);
  });
});
