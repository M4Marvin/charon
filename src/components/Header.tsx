import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, Plus, Settings, Shield } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/common/Logo";
import { authClient } from "@/lib/auth-client";

export default function Header() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/60 px-4 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/chat" className="flex items-center gap-2 no-underline">
            <Logo className="size-7" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Charon</span>
          </Link>
          {!isPending && session?.user ? (
            <nav aria-label="Primary" className="hidden md:flex items-center gap-6 text-sm">
              <Link
                to="/chat"
                className="text-2 hover:text-1 no-underline transition-colors inline-flex items-center h-14"
                activeProps={{
                  className: "!text-brand-strong shadow-[inset_0_-2px_0_0_var(--brand)]",
                }}
              >
                Chats
              </Link>
              <Link
                to="/characters"
                className="text-2 hover:text-1 no-underline transition-colors inline-flex items-center h-14"
                activeProps={{
                  className: "!text-brand-strong shadow-[inset_0_-2px_0_0_var(--brand)]",
                }}
              >
                Characters
              </Link>
              <Link
                to="/lorebooks"
                className="text-2 hover:text-1 no-underline transition-colors inline-flex items-center h-14"
                activeProps={{
                  className: "!text-brand-strong shadow-[inset_0_-2px_0_0_var(--brand)]",
                }}
              >
                Lorebooks
              </Link>
            </nav>
          ) : null}
        </div>
        <nav aria-label="Account actions" aria-live="polite" className="flex items-center gap-2 text-sm">
          {isPending ? null : session?.user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Plus className="size-4" data-icon="inline-start" />
                    New
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/characters">New chat</Link>
                  </DropdownMenuItem>
                  {session.user.role === "admin" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/characters/new">Import character</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/lorebooks/new">New lorebook</Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full pl-0.5 text-sm outline-none hover:bg-muted/50 rounded-lg px-1.5 py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">
                        {session.user.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-2 hidden sm:inline">{session.user.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {session.user.role === "admin" ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/users">
                          <Shield className="size-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
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
                    <LogOut className="size-4" />
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
