import { Link, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export default function Header() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
        <Link
          to="/c"
          className="text-sm font-semibold tracking-tight text-foreground no-underline"
        >
          st-v2
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {isPending ? null : session?.user ? (
            <>
              <Link
                to="/characters"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Characters
              </Link>
              <Link
                to="/c"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Chats
              </Link>
              <Link
                to="/lorebooks"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Lorebooks
              </Link>
              {session.user.role === "admin" && (
                <Link
                  to="/admin/users"
                  className="text-muted-foreground no-underline transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  Admin
                </Link>
              )}
              {session.user.role === "admin" && (
                <Link
                  to="/settings"
                  className="text-muted-foreground no-underline transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  Settings
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full pl-0.5 text-sm outline-none">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">
                        {session.user.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground hidden sm:inline">
                      {session.user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => {
                      authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            void router.navigate({ to: "/" });
                          },
                        },
                      });
                    }}
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
