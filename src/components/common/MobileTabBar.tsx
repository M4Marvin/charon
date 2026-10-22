import { Link } from "@tanstack/react-router";
import { MessageCircle, Users, BookOpen, Plus } from "lucide-react";
import { openNewSheet } from "@/components/common/NewSheet";

export function MobileTabBar() {
  const base =
    "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg text-xs leading-none transition-colors no-underline";
  const active = "text-brand-strong font-medium";

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-popover/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        <Link to="/chat" className={base} activeProps={{ className: `${base} ${active}` }}>
          <MessageCircle className="size-5" />
          Chats
        </Link>
        <Link to="/characters" className={base} activeProps={{ className: `${base} ${active}` }}>
          <Users className="size-5" />
          Characters
        </Link>
        <button type="button" onClick={openNewSheet} className={base} aria-label="Create">
          <div className="flex size-10 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-lg">
            <Plus className="size-5" aria-hidden="true" />
          </div>
        </button>
        <Link to="/lorebooks" className={base} activeProps={{ className: `${base} ${active}` }}>
          <BookOpen className="size-5" />
          Lorebooks
        </Link>
      </div>
    </nav>
  );
}
