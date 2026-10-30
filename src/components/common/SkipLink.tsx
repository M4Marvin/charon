/** First tab stop in a shell with navigation: jumps past the nav to #main. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-surface px-3 py-2 text-sm text-1 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:outline-2 focus:outline-brand focus:outline-offset-2"
    >
      Skip to content
    </a>
  );
}
