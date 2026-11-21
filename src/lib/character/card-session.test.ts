import { deflateSync } from "node:zlib";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "crc";
import { describe, expect, it } from "vitest";
import { writeCharacterCard } from "@/lib/st-core/character";
import { CardSession } from "./card-session.js";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(name: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(name, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** Minimal valid 1x1 RGBA PNG, just enough for png-chunks-extract. */
function basePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(Buffer.from([0, 200, 100, 80, 255]));
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CARD = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Mia",
    description: "A quiet girl.",
    personality: "",
    scenario: "",
    first_mes: "…You're back.",
    mes_example: "",
    creator_notes: "Created by Test",
    alternate_greetings: ["a", "b"],
    tags: ["OC"],
    creator: "Test",
    character_version: "1",
  },
};

async function fixture(card: unknown = CARD): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "card-session-"));
  const file = join(dir, "card.png");
  await writeFile(file, writeCharacterCard(basePng(), JSON.stringify(card)));
  return file;
}

describe("CardSession", () => {
  it("reads the card from the PNG", async () => {
    const session = await CardSession.open(await fixture());
    expect(session.spec).toBe("v2");
    expect(session.data().name).toBe("Mia");
    expect(session.dirty).toBe(false);
  });

  it("edits in memory and saves back to the image", async () => {
    const file = await fixture();
    const session = await CardSession.open(file);
    session.set("data.name", "Amanda");
    session.set("data.alternate_greetings[2]", "new");
    expect(session.dirty).toBe(true);
    expect(session.get("data.name")).toBe("Amanda");

    await session.save();
    expect(session.dirty).toBe(false);

    const reopened = await CardSession.open(file);
    expect(reopened.data().name).toBe("Amanda");
    expect((reopened.data().alternate_greetings as string[])[2]).toBe("new");
  });

  it("writes a copy without touching the original", async () => {
    const file = await fixture();
    const out = `${file}.copy.png`;
    const session = await CardSession.open(file);
    session.set("data.name", "Copy");
    await session.save(out, false);

    expect((await CardSession.open(file)).data().name).toBe("Mia");
    expect((await CardSession.open(out)).data().name).toBe("Copy");
    expect(await readFile(`${file}.bak`).catch(() => null)).toBeNull();
  });

  it("reload discards unsaved changes", async () => {
    const session = await CardSession.open(await fixture());
    session.set("data.name", "nope");
    await session.reload();
    expect(session.data().name).toBe("Mia");
    expect(session.dirty).toBe(false);
  });

  it("counts unique images across greetings", async () => {
    const session = await CardSession.open(
      await fixture({
        ...CARD,
        data: {
          ...CARD.data,
          first_mes: "![](https://x/1.jpg)",
          alternate_greetings: ["![](https://x/1.jpg)", "![](https://x/2.jpg)"],
        },
      }),
    );
    expect(session.images()).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
  });
});
