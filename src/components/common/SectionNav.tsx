import { useState, useEffect, useCallback } from "react";

interface SectionDef {
  id: string;
  label: string;
  empty?: boolean;
}

interface SectionNavProps {
  sections: SectionDef[];
}

export function SectionNav({ sections }: SectionNavProps) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-10% 0px -80% 0px" },
    );

    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <>
      {/* Desktop: sticky left rail */}
      <nav className="hidden lg:block sticky top-20 self-start space-y-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleClick(s.id)}
            className={`block w-full text-left text-sm py-1.5 px-3 rounded-md transition-colors ${
              active === s.id
                ? "text-brand-strong font-medium"
                : "text-2 hover:text-1"
            }`}
          >
            {s.label}
            {s.empty ? <span className="text-3 ml-1 text-xs">· empty</span> : null}
          </button>
        ))}
      </nav>
      {/* Mobile: horizontal chip scroller */}
      <nav className="lg:hidden flex gap-1 overflow-x-auto no-scrollbar pb-2">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleClick(s.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
              active === s.id
                ? "bg-brand/20 text-brand-strong font-medium"
                : "text-2 hover:bg-muted"
            }`}
          >
            {s.label}
            {s.empty ? <span className="text-3"> · empty</span> : null}
          </button>
        ))}
      </nav>
    </>
  );
}
