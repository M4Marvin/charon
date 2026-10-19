import type { EffectiveCharacter } from "./contract";

export const DEFAULT_IMAGE_STYLE =
  "anime style, clean lineart, detailed shading, cinematic composition";

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/[^a-z0-9 :'-]/g, "")
    .trim();
}

/**
 * The stable, deterministic part of a Danbooru-style prompt. Only tags that
 * describe the character belong here; scene, pose, and camera go in the
 * model-produced delta and are never allowed to redefine identity.
 */
export function canonicalIdentity(character: EffectiveCharacter): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of character.tags) {
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    if (["male", "female", "oc", "original"].includes(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 16) break;
  }
  return tags;
}

export function assembleImagePrompt(character: EffectiveCharacter, modelDelta: string): string {
  const identity = canonicalIdentity(character);
  const reserved = new Set([...identity, ...DEFAULT_IMAGE_STYLE.split(",").map(normalizeTag)]);
  const scene: string[] = [];
  const seen = new Set<string>();

  for (const raw of modelDelta.split(/[,\n]+/)) {
    const tag = normalizeTag(raw);
    if (!tag || reserved.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    scene.push(tag);
    if (scene.length >= 32) break;
  }

  return [...identity, ...scene, DEFAULT_IMAGE_STYLE].filter(Boolean).join(", ");
}

export function sanitizeImpersonation(
  text: string,
  personaName: string,
  characterName?: string,
): string {
  let value = text.trim();
  value = value.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "");
  for (const name of [personaName, characterName]) {
    if (!name) continue;
    const prefix = new RegExp("^" + escapeRegExp(name) + "\\s*:\\s*", "i");
    value = value.replace(prefix, "");
  }
  return value.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}
