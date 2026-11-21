import { randomUUID } from "node:crypto";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  getCharacterCardSpec,
  parseCharacterCard,
  writeCharacterCard,
  type CharacterCardSpec,
} from "@/lib/st-core/character";
import { getPath, parsePath, setPath, unsetPath } from "./card-path.js";

const IMAGE_MD = /!\[[^\]]*\]\(([^)\s]+)/g;

/**
 * One character card held in memory: read once from a PNG, edited field by
 * field, written back only on `save`. Node-only (st-core uses `Buffer`).
 */
export class CardSession {
  dirty = false;

  private constructor(
    readonly file: string,
    public card: Record<string, unknown>,
    public spec: CharacterCardSpec,
  ) {}

  static async open(file: string): Promise<CardSession> {
    const path = resolve(file);
    const image = await readFile(path);
    return new CardSession(
      path,
      parseCharacterCard<Record<string, unknown>>(image),
      getCharacterCardSpec(image),
    );
  }

  data(): Record<string, unknown> {
    return (this.card.data ?? this.card) as Record<string, unknown>;
  }

  get(path: string): unknown {
    return getPath(this.card, parsePath(path));
  }

  set(path: string, value: unknown): void {
    setPath(this.card, parsePath(path), value);
    this.dirty = true;
  }

  unset(path: string): void {
    unsetPath(this.card, parsePath(path));
    this.dirty = true;
  }

  images(): string[] {
    const d = this.data();
    const greetings = [d.first_mes, ...((d.alternate_greetings as string[] | undefined) ?? [])];
    const found = new Set<string>();
    for (const text of [d.creator_notes, ...greetings]) {
      if (typeof text !== "string") continue;
      for (const match of text.matchAll(IMAGE_MD)) found.add(match[1]);
    }
    return [...found];
  }

  summary(): string {
    const d = this.data();
    const alt = (d.alternate_greetings as unknown[] | undefined) ?? [];
    const sizes = ["description", "personality", "scenario", "mes_example", "system_prompt"]
      .map((key) => [key, typeof d[key] === "string" ? (d[key] as string).length : 0] as const)
      .filter(([, size]) => size > 0)
      .map(([key, size]) => `${key} ${size}`);
    return [
      `file      ${basename(this.file)}${this.dirty ? " (unsaved changes)" : ""}`,
      `spec      ${this.spec ?? "none"}`,
      `name      ${String(d.name ?? "")}`,
      `creator   ${String(d.creator ?? "")}`,
      `version   ${String(d.character_version ?? "")}`,
      `tags      ${Array.isArray(d.tags) ? d.tags.length : 0}`,
      `greetings ${alt.length + 1} (1 + ${alt.length} alternate)`,
      `images    ${this.images().length} unique`,
      `fields    ${sizes.join(", ") || "none"}`,
    ].join("\n");
  }

  json(): string {
    return JSON.stringify(this.card, null, 2);
  }

  /** Write the card into the PNG. Atomic; keeps `<file>.bak` on in-place saves. */
  async save(out?: string, backup = true): Promise<string> {
    const target = resolve(out ?? this.file);
    const image = await readFile(this.file);
    const next = writeCharacterCard(image, this.json());
    const tmp = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
    await writeFile(tmp, next);
    if (backup && target === this.file) await copyFile(this.file, `${target}.bak`);
    await rename(tmp, target);
    this.dirty = false;
    return target;
  }

  async reload(): Promise<void> {
    const fresh = await CardSession.open(this.file);
    this.card = fresh.card;
    this.spec = fresh.spec;
    this.dirty = false;
  }
}
