import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsSaveProvider, SettingsSaveStatus } from "@/features/chat/ui/settings/save-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

const SECTION_IDS: Record<string, string> = {
  "/settings": "overview",
  "/settings/preferences": "display",
  "/settings/profile": "profile",
  "/settings/defaults": "model",
  "/settings/providers": "providers",
  "/settings/presets": "presets",
};

const SECTIONS = [
  {
    to: "/settings/preferences",
    label: "Preferences",
    subtitle: "Appearance options saved in this browser.",
  },
  {
    to: "/settings/profile",
    label: "Profile",
    subtitle: "Your account and password.",
  },
  {
    to: "/settings/defaults",
    label: "Defaults",
    subtitle: "Provider, model, and preset used when a chat inherits them.",
  },
  {
    to: "/settings/providers",
    label: "Providers",
    subtitle: "OpenAI-compatible endpoints shared across chats.",
  },
  {
    to: "/settings/presets",
    label: "Presets",
    subtitle: "Reusable generation parameters.",
  },
] as const;

function SettingsLayout() {
  const { pathname } = useLocation();
  const sectionId = SECTION_IDS[pathname] ?? "overview";
  const active = SECTIONS.find((section) => section.to === pathname) ?? SECTIONS[0];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader title="Settings" subtitle={active.subtitle} />
      <div className="lg:flex lg:gap-10">
        <div className="mb-4 lg:mb-0 lg:w-44 lg:shrink-0">
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 w-full justify-between gap-3"
                  aria-label={`Settings section. Current: ${active.label}`}
                >
                  {active.label}
                  <ChevronDown className="size-4 text-2" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--radix-dropdown-menu-trigger-width)]"
              >
                {SECTIONS.map((section) => (
                  <DropdownMenuItem key={section.to} asChild className="min-h-11">
                    <Link
                      to={section.to}
                      className={cn(
                        "no-underline",
                        section.to === pathname && "font-medium text-brand-strong",
                      )}
                      aria-current={section.to === pathname ? "page" : undefined}
                    >
                      {section.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav
            aria-label="Settings sections"
            className="hidden lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-1"
          >
            {SECTIONS.map((section) => (
              <Link
                key={section.to}
                to={section.to}
                className="flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-2 no-underline transition-colors hover:bg-muted hover:text-1"
                activeProps={{
                  className: "!text-brand-strong bg-brand/10 font-medium",
                  "aria-current": "page",
                }}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </div>

        <SettingsSaveProvider activeSection={sectionId}>
          <div className="min-w-0 flex-1 lg:max-w-[840px]">
            <div className="mb-4 flex min-h-5 items-center">
              {sectionId === "model" || sectionId === "display" ? (
                <SettingsSaveStatus idleLabel="Changes save automatically" />
              ) : null}
            </div>
            <Outlet />
          </div>
        </SettingsSaveProvider>
      </div>
    </main>
  );
}
