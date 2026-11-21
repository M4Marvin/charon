import { stat } from "node:fs/promises";
import { join } from "node:path";
import { metadataField, metadataTags } from "./discovery.js";
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

/** Payload built from an in-memory card (the MCP session), not from disk. */
export function buildPayloadFromCard(
  card: Record<string, unknown>,
  base: SubmitPayload,
): SubmitPayload {
  const d = (card.data ?? card) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const alternates = Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [];
  return {
    ...base,
    name: text(d.name) || base.name,
    creatorsNotes: text(d.creator_notes) || base.creatorsNotes,
    description: text(d.description) || base.description,
    firstMessage: text(d.first_mes) || base.firstMessage,
    alternates: alternates.length ? alternates.map(String) : base.alternates,
    scenario: text(d.scenario) || base.scenario,
    exampleDialogs: text(d.mes_example) || base.exampleDialogs,
    systemPrompt: text(d.system_prompt) || base.systemPrompt,
    postHistory: text(d.post_history_instructions) || base.postHistory,
    tags: Array.isArray(d.tags) && d.tags.length ? d.tags.map(String) : base.tags,
  };
}

/**
 * Fills chub's create form field by field. Tags are typed with real keys by
 * the caller (Ant's multi-select drops synthetic Enter after the first token);
 * Create Character is clicked by the caller too, because chub ignores an
 * untrusted click on that button.
 */
export const SUBMIT_SCRIPT = String.raw`(async (payload) => {
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
    const el = document.getElementById(id);
    if (!el) throw new Error("field not found: " + id);
    setValue(el, value);
    done.push(id);
  }

  const addButton = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Add Alternate Greeting");
  const alternatesNow = () => [...document.querySelectorAll("textarea")]
    .filter((t) => (t.closest("div.ant-form-item")?.querySelector("label")?.innerText ?? "").trim() === "Alternate greetings");
  let guard = 0;
  while (alternatesNow().length < payload.alternates.length && guard++ < 8) {
    if (!addButton) throw new Error("add alternate button not found");
    addButton.click();
    await new Promise((r) => setTimeout(r, 350));
  }
  if (alternatesNow().length < payload.alternates.length)
    throw new Error("could not add alternate rows: " + alternatesNow().length + "/" + payload.alternates.length);
  payload.alternates.forEach((text, index) => setValue(alternatesNow()[index], text));
  if (payload.alternates.length) done.push("alternates:" + payload.alternates.length);

  if (payload.characterNote) {
    const note = [...document.querySelectorAll("textarea")].find((t) => t.placeholder === "Character's Note");
    if (note) {
      setValue(note, payload.characterNote);
      done.push("character_note");
    }
  }

  clickLabel(payload.type);
  clickLabel(payload.rating === "NSFW" ? "🔥 NSFW" : "👪 SFW");
  done.push(payload.type, payload.rating);

  return { done, url: location.href };
})`;

/** `https://chub.ai/characters/<user>/<slug>` → `https://chub.ai/edit/<user>/<slug>` */
export function editUrlFor(published: string | null): string | null {
  const match = published?.match(/chub\.ai\/characters\/([^/\s?#]+)\/([^/\s?#]+)/);
  return match ? `https://chub.ai/edit/${match[1]}/${match[2]}` : null;
}

/** The `Published` row of metadata.md, if the card has been submitted. */
export async function publishedUrl(dir: string): Promise<string | null> {
  return metadataField(await text(join(dir, "metadata.md")), "Published");
}

/**
 * Fills chub's edit form (`/edit/<user>/<slug>`) from the same payload. It
 * never changes visibility, rating or avatar, and reports the tag diff instead
 * of typing tags. The caller clicks Update Character afterwards.
 */
export const EDIT_SCRIPT = String.raw`(async (payload) => {
  const setValue = (el, value) => {
    if (!el) throw new Error("missing field");
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const rows = () => [...document.querySelectorAll("textarea")]
    .filter((t) => (t.closest("div.ant-form-item")?.querySelector("label")?.innerText ?? "").trim() === "Alternate greetings");
  const done = [];

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
    const el = document.getElementById(id);
    if (!el) throw new Error("field not found: " + id);
    setValue(el, value);
    done.push(id);
  }

  const want = payload.alternates.length;
  let guard = 0;
  while (rows().length < want && guard++ < 8) {
    const add = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Add Alternate Greeting");
    if (!add) break;
    add.click();
    await new Promise((r) => setTimeout(r, 350));
  }
  if (rows().length < want) throw new Error("could not add alternate rows: " + rows().length + "/" + want);
  payload.alternates.forEach((text, index) => setValue(rows()[index], text));
  guard = 0;
  while (rows().length > want && guard++ < 8) {
    const item = rows()[rows().length - 1].closest("div.ant-form-item");
    const del = item && item.querySelector("button.ant-btn-icon-only");
    if (!del) throw new Error("delete button not found");
    del.click();
    await new Promise((r) => setTimeout(r, 350));
  }
  if (rows().length > want)
    throw new Error("delete " + (rows().length - want) + " extra alternate rows by hand, then run the script again");
  done.push("alternates:" + want);

  const tagItem = [...document.querySelectorAll("div.ant-form-item")]
    .find((item) => item.querySelector('label[title="Tags"]'));
  const current = tagItem ? [...tagItem.querySelectorAll(".ant-tag")].map((t) => t.innerText.trim()) : [];
  const norm = (value) => value.trim().toLowerCase();
  const missing = payload.tags.filter((tag) => !current.some((c) => norm(c) === norm(tag)));
  const extra = current.filter((c) => !payload.tags.some((tag) => norm(tag) === norm(c)));

  return { done, tags: { count: current.length, missing, extra }, url: location.href };
})`;
