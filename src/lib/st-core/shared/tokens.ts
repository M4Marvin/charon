import type { ITokenCounter } from "./types.js";

/**
 * A minimal token counter using whitespace-splitting approximation.
 * Replace with tiktoken or your own implementation.
 */
export class ApproxTokenCounter implements ITokenCounter {
  count(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}
