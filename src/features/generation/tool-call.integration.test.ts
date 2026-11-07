import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { aiProviders, characters, userSettings } from "@/db/schema";
import { createChat } from "@/features/chat/tree/service";
import { runProposal } from "./proposal";

function sse(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function chunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return sse({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(finishReason === "stop"
      ? { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }
      : {}),
  });
}

/**
 * First call asks for read_scene; the call after the tool result returns text.
 * This exercises AI.chat -> Effect serverTool -> provided ReadToolRuntime.
 */
async function startToolProvider(): Promise<{
  server: Server;
  baseUrl: string;
  bodies: Array<Record<string, unknown>>;
}> {
  const bodies: Array<Record<string, unknown>> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (part) => (body += part));
    request.on("end", () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body) as Record<string, unknown>;
      } catch {
        parsed = { raw: body };
      }
      bodies.push(parsed);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const hasToolResult = JSON.stringify(parsed).includes('"role":"tool"');
      if (!hasToolResult) {
        response.write(
          chunk({
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                type: "function",
                function: { name: "read_scene", arguments: '{"limit":1}' },
              },
            ],
          }),
        );
        response.write(chunk({}, "tool_calls"));
      } else {
        response.write(chunk({ role: "assistant", content: "The scene is " }));
        response.write(chunk({ content: "visible." }));
        response.write(chunk({}, "stop"));
      }
      response.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1`, bodies };
}

describe("Effect tool call integration", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;
  let userId: string;
  let chatId: string;
  let fake: Awaited<ReturnType<typeof startToolProvider>>;

  beforeEach(async () => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    fake = await startToolProvider();
    const data = makeCharacterData();
    db.insert(characters)
      .values({
        id: "char-1",
        name: data.name,
        data,
        spec: "chara_card_v2",
        specVersion: "2.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(aiProviders)
      .values({
        id: "prov-1",
        name: "Fake",
        baseUrl: fake.baseUrl,
        apiKey: "test-key",
        defaultModel: "test-model",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    db.insert(userSettings)
      .values({ userId, defaultProviderId: "prov-1", defaultSelectedModel: "test-model" })
      .run();
    chatId = createChat({ characterId: "char-1", title: "Test", greetings: ["Hello!"] }, db).id;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => fake.server.close(() => resolve()));
    ctx.sqlite.close();
  });

  it("sends strict tools, runs the Effect tool, and returns its result to the model", async () => {
    const result = await runProposal(userId, "User", { chatId, trigger: "impersonate" }, db);

    expect(result.text).toBe("The scene is visible.");
    expect(fake.bodies).toHaveLength(2);

    const first = fake.bodies[0] as {
      tools?: Array<{ function?: { name?: string; strict?: boolean } }>;
    };
    const readScene = first.tools?.find((tool) => tool.function?.name === "read_scene");
    expect(readScene?.function?.strict).toBe(true);

    // The tool read the active branch through ReadToolRuntime; its result is
    // in the second model request, not in the app's transcript.
    expect(JSON.stringify(fake.bodies[1])).toContain("Hello!");
    expect(JSON.stringify(fake.bodies[1])).toContain('"role":"tool"');
  }, 20_000);
});
