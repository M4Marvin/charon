/**
 * One-shot CSS feature detection for progressive enhancements on the chat
 * page. Evaluated once at module load; the `typeof CSS` guard keeps SSR
 * happy (the server only ever renders the fallback markup, which never
 * differs — the gated code paths are effects and handlers).
 */
export const supportsFieldSizing =
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

export const supportsScrollDrivenAnimations =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "scroll()");
