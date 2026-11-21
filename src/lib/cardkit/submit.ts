import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CardPackage } from "./types.js";

export type SubmitPayload = {
  name: string;
  tagline: string;
  inChatName: string;
  creatorsNotes: string;
  description: string;
  firstMessage: string;
  alternates: string[];
  scenario: string;
  exampleDialogs: string;
  systemPrompt: string;
  postHistory: string;
  characterNote: string;
  tags: string[];
  type: "Public" | "Private" | "Unlisted";
  rating: "SFW" | "NSFW";
  avatar: string | null;
};

async function text(path: string): Promise<string | null> {
  try {
    return await (await import("node:fs/promises")).readFile(path, "utf8");
  } catch {
    return null;
  }
}

function metadataField(metadata: string | null, field: string): string | null {
  if (!metadata) return null;
  const line = metadata
    .split("\n")
    .find((l) => l.toLowerCase().includes(`| ${field.toLowerCase()}`));
  if (!line) return null;
  const cell = line.split("|")[2] ?? "";
  return cell.replace(/`/g, "").replace(/\*\*/g, "").trim() || null;
}

function metadataTags(metadata: string | null): string[] {
  if (!metadata) return [];
  const section = metadata.split(/^## Tags/m)[1] ?? "";
  const block = section.split(/^##/m)[0] ?? "";
  return [...block.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
}

export async function buildSubmitPayload(pkg: CardPackage): Promise<SubmitPayload> {
  const metadata = await text(join(pkg.dir, "metadata.md"));
  const scenario = (await text(join(pkg.dir, "scenario.md")))?.trim() ?? "";
  const example = (await text(join(pkg.dir, "example_dialogs.md")))?.trim() ?? "";
  const avatarPath = join(pkg.dir, "avatar.png");
  const hasAvatar = Boolean(await stat(avatarPath).catch(() => null));

  return {
    name: metadataField(metadata, "Name") ?? pkg.name,
    tagline: pkg.tagline ?? "",
    inChatName: "",
    creatorsNotes: pkg.page ?? "",
    description: pkg.personality ?? "",
    firstMessage: pkg.greetings[0]?.text ?? "",
    alternates: pkg.greetings.slice(1).map((greeting) => greeting.text),
    scenario,
    exampleDialogs: example,
    systemPrompt: "",
    postHistory: "",
    characterNote: "",
    tags: metadataTags(metadata),
    type: "Private",
    rating: "NSFW",
    avatar: hasAvatar ? avatarPath : null,
  };
}

/** Chara card v2 file for chub's own Import JSON input. */
export function buildCardJson(payload: SubmitPayload): string {
  return JSON.stringify(
    {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: payload.name,
        description: payload.description,
        personality: "",
        scenario: payload.scenario,
        first_mes: payload.firstMessage,
        mes_example: payload.exampleDialogs,
        creator_notes: payload.creatorsNotes,
        system_prompt: payload.systemPrompt,
        post_history_instructions: payload.postHistory,
        alternate_greetings: payload.alternates,
        tags: payload.tags,
        creator: "SmutFixer",
        character_version: "1.0",
        extensions: {},
      },
    },
    null,
    2,
  );
}

/**
 * Post-import steps for chub's create form: the Import JSON input fills
 * everything except the tagline, and the type/rating radios are not part of
 * the card file. Small enough to inline in one eval.
 */
export const POST_IMPORT_SCRIPT = String.raw`(async (payload) => {
  const setValue = (el, value) => {
    if (!el) throw new Error("missing field");
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const clickLabel = (label) => {
    const target = [...document.querySelectorAll("label")].find((l) => l.innerText.trim() === label);
    if (!target) throw new Error("label not found: " + label);
    target.click();
  };
  const done = [];

  if (payload.tagline) {
    setValue(document.getElementById("tagline"), payload.tagline);
    done.push("tagline");
  }
  clickLabel(payload.type);
  clickLabel(payload.rating === "NSFW" ? "🔥 NSFW" : "👪 SFW");
  done.push(payload.type, payload.rating);

  const alternates = [...document.querySelectorAll("textarea")]
    .filter((t) => (t.closest("div.ant-form-item")?.querySelector("label")?.innerText ?? "").trim() === "Alternate greetings").length;
  done.push("alternates:" + alternates);

  if (payload.submit) {
    const create = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Create Character");
    if (!create) throw new Error("create button not found");
    create.click();
    done.push("submitted");
  }
  return { done, url: location.href };
})`;
