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

/**
 * Fills the chub create_character form from a payload. Runs inside the page;
 * never submits unless `payload.submit` is true. Returns a report of the work.
 *
 * Tags are NOT set here: Ant's multi-select stops accepting synthetic Enter
 * after the first token, so the caller types them with real key events.
 */
export const SUBMIT_SCRIPT = String.raw`(async (payload) => {
  const setValue = (el, value) => {
    if (!el) throw new Error("missing field");
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const byId = (id) => document.getElementById(id);
  const formItemByLabel = (label) => [...document.querySelectorAll("div.ant-form-item")]
    .find((item) => (item.querySelector("label")?.innerText ?? "").trim() === label);
  const clickLabel = (label) => {
    const target = [...document.querySelectorAll("label")].find((l) => l.innerText.trim() === label);
    if (!target) throw new Error("label not found: " + label);
    target.click();
  };
  const filled = [];

  for (const [id, value] of Object.entries({
    name: payload.name,
    tagline: payload.tagline,
    in_chat_name: payload.inChatName,
    description: payload.creatorsNotes,
    personality: payload.description,
    first_message: payload.firstMessage,
    scenario: payload.scenario,
    example_dialogs: payload.exampleDialogs,
    system_prompt: payload.systemPrompt,
    post_history_instructions: payload.postHistory,
  })) {
    if (!value) continue;
    const el = byId(id);
    if (!el) throw new Error("field not found: " + id);
    setValue(el, value);
    filled.push(id);
  }

  const note = [...document.querySelectorAll("textarea")].find((t) => t.placeholder === "Character's Note");
  if (note && payload.characterNote) {
    setValue(note, payload.characterNote);
    filled.push("character_note");
  }

  const countAlternates = () => [...document.querySelectorAll("textarea")]
    .filter((t) => (t.closest("div.ant-form-item")?.querySelector("label")?.innerText ?? "").trim() === "Alternate greetings").length;
  const addButton = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Add Alternate Greeting");
  while (countAlternates() < payload.alternates.length) {
    if (!addButton) throw new Error("add alternate button not found");
    addButton.click();
    await new Promise((r) => setTimeout(r, 120));
  }
  const alternates = [...document.querySelectorAll("textarea")]
    .filter((t) => (t.closest("div.ant-form-item")?.querySelector("label")?.innerText ?? "").trim() === "Alternate greetings");
  payload.alternates.forEach((text, index) => setValue(alternates[index], text));
  if (payload.alternates.length) filled.push("alternates:" + payload.alternates.length);

  clickLabel(payload.type);
  clickLabel(payload.rating === "NSFW" ? "🔥 NSFW" : "👪 SFW");
  filled.push(payload.type, payload.rating);

  if (payload.submit) {
    const create = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Create Character");
    if (!create) throw new Error("create button not found");
    create.click();
    filled.push("submitted");
  }

  return { filled, url: location.href };
})`;
