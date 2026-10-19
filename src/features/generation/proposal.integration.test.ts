import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { eq } from "drizzle-orm";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { makeCharacterData } from "@/db/__tests__/character-data";
import { aiProviders, characters, generationJobs, userSettings } from "@/db/schema";
import { createChat, getMessages } from "@/features/chat/tree/service";
import { getProposal } from "@/db/repositories/generation";
import { runProposal } from "./proposal";
import { prepareGeneration } from "./prepare";

function sse(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

async function startFakeProvider(): Promise<{
  server: Server;
  baseUrl: string;
  bodies: unknown[];
}> {
  const bodies: unknown[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (part) => (body += part));
    request.on("end", () => {
      try {
        bodies.push(JSON.parse(body));
      } catch {
        bodies.push(body);
      }
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        sse({
          id: "chatcmpl-1",
          object: "chat.completion.chunk",
          created: 1,
          model: "test-model",
          choices: [
            { index: 0, delta: { role: "assistant", content: "User: " }, finish_reason: null },
          ],
        }),
      );
      response.write(
        sse({
          id: "chatcmpl-1",
          object: "chat.completion.chunk",
          created: 1,
          model: "test-model",
          choices: [{ index: 0, delta: { content: "Hello from the fake." }, finish_reason: null }],
        }),
      );
      response.write(
        sse({
          id: "chatcmpl-1",
          object: "chat.completion.chunk",
          created: 1,
          model: "test-model",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
      response.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1`, bodies };
}

describe("runProposal integration", () => {
  let ctx: ReturnType<typeof makeTestDb>;
  let db: TestDb;
  let userId: string;
  let chatId: string;
  let fake: Awaited<ReturnType<typeof startFakeProvider>>;

  beforeEach(async () => {
    ctx = makeTestDb();
    db = ctx.db;
    userId = seedTestUser(db);
    fake = await startFakeProvider();
    const data = makeCharacterData();
    data.tags = ["1girl", "silver hair"];
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

  it("streams, sanitizes impersonation, and creates an accepted proposal", async () => {
    const result = await runProposal(userId, "User", { chatId, trigger: "impersonate" }, db);

    expect(result.text).toBe("Hello from the fake.");
    expect(getProposal(result.proposalId, db)?.status).toBe("accepted");
    expect(fake.bodies.length).toBeGreaterThan(0);
    const body = fake.bodies[0] as {
      max_output_tokens?: unknown;
      max_tokens?: number;
      messages: unknown[];
    };
    expect(body.max_output_tokens).toBeUndefined();
    expect(typeof body.max_tokens).toBe("number");
    expect(Array.isArray(body.messages)).toBe(true);
  }, 20_000);

  it("fails the job when streaming setup throws before the lease is taken", async () => {
    db.update(aiProviders).set({ baseUrl: "not-a-url" }).where(eq(aiProviders.id, "prov-1")).run();

    await expect(
      runProposal(userId, "User", { chatId, trigger: "impersonate" }, db),
    ).rejects.toThrow(/base URL/);

    const job = db.select().from(generationJobs).where(eq(generationJobs.chatId, chatId)).get();
    expect(job?.status).toBe("failed");

    // The failed request must not wedge the chat behind an active job.
    await expect(
      prepareGeneration(userId, { chatId, trigger: "send", content: "Hi" }, "User", db),
    ).resolves.toMatchObject({ jobId: expect.any(String) });
  }, 20_000);

  it("treats a transform as a composer draft and never appends a message", async () => {
    const before = getMessages(chatId, db);
    const result = await runProposal(
      userId,
      "User",
      {
        chatId,
        trigger: "transform",
        selection: [before[0].localId],
        instruction: "Summarize this.",
      },
      db,
    );

    expect(result.text).toBe("User: Hello from the fake.");
    expect(getProposal(result.proposalId, db)?.status).toBe("accepted");
    expect(getMessages(chatId, db)).toHaveLength(before.length);
  }, 20_000);

  it("assembles image prompts with canonical identity and style", async () => {
    const result = await runProposal(userId, "User", { chatId, trigger: "image" }, db);

    expect(result.text.startsWith("1girl, silver hair,")).toBe(true);
    expect(result.text).toContain("painterly");
    expect(result.text).not.toContain("User:");
  }, 20_000);
});
