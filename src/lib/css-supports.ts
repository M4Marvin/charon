/**
 * One-shot CSS feature detection for progressive enhancements on the chat
 * page. Evaluated once at module load; the `typeof CSS` guard keeps SSR
 * happy (the server only ever renders the fallback markup, which never
 * differs — the gated code paths are effects and handlers).
 */
export const supportsFieldSizing =
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

/**
 * The chat top fade consumes a NAMED scroll timeline (`animation-timeline:
 * --chat-top`, published via `scroll-timeline-name` and hoisted with
 * `timeline-scope`), so probe the value form the CSS actually uses: `scroll()`
 * and a dashed-ident are distinct forms in the `animation-timeline` grammar
 * (MDN gates named-timeline support exactly this way). This alone is not
 * proof the fade works — MessageList additionally probes timeline liveness,
 * because engines exist that build the timeline but never activate it.
 */
export const supportsNamedScrollTimeline =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "--chat-top");
