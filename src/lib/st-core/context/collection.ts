import type { PromptSection } from './types.js';

/**
 * Ordered collection of prompt sections.
 * Supports insertion at any position, override, and reordering.
 */
export class PromptCollection {
  /** Ordered list of prompt sections. */
  collection: PromptSection[] = [];

  /** Add a section to the end of the collection. */
  add(section: PromptSection): void {
    const existing = this.collection.findIndex((s) => s.identifier === section.identifier);
    if (existing !== -1) {
      this.collection[existing] = section;
    } else {
      this.collection.push(section);
    }
  }

  /** Insert a section at a specific index. */
  insertAt(section: PromptSection, index: number): void {
    this.collection.splice(index, 0, section);
  }

  /** Get a section by identifier. */
  get(identifier: string): PromptSection | undefined {
    return this.collection.find((s) => s.identifier === identifier);
  }

  /** Check if a section exists. */
  has(identifier: string): boolean {
    return this.collection.some((s) => s.identifier === identifier);
  }

  /** Get the index of a section by identifier. */
  index(identifier: string): number {
    return this.collection.findIndex((s) => s.identifier === identifier);
  }

  /** Override a section at a specific index (adds if missing). */
  override(section: PromptSection, index: number): void {
    if (index >= 0 && index < this.collection.length) {
      this.collection[index] = section;
    } else {
      this.add(section);
    }
  }

  /** Remove a section by identifier. */
  remove(identifier: string): void {
    const idx = this.index(identifier);
    if (idx !== -1) this.collection.splice(idx, 1);
  }

  /** Reorder sections by an array of identifiers. */
  reorder(identifiers: string[]): void {
    const reordered: PromptSection[] = [];
    for (const id of identifiers) {
      const section = this.get(id);
      if (section) {
        reordered.push(section);
        this.remove(id);
      }
    }
    // Append any remaining sections not in the order list
    this.collection = [...reordered, ...this.collection];
  }

  /** Clear all sections. */
  clear(): void {
    this.collection = [];
  }

  /** Return all sections as a flat array. */
  toArray(): PromptSection[] {
    return [...this.collection];
  }
}
