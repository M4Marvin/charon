import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
        <Link to="/" className="text-sm font-semibold tracking-tight text-foreground no-underline">
          st-v2
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            to="/"
            className="text-muted-foreground no-underline transition-colors hover:text-foreground"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground" }}
          >
            Home
          </Link>
          <Link
            to="/characters"
            className="text-muted-foreground no-underline transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Characters
          </Link>
          <Link
            to="/lorebooks"
            className="text-muted-foreground no-underline transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Lorebooks
          </Link>
        </nav>
      </div>
    </header>
  );
}
