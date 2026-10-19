import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { SettingsSaveProvider, SettingsSaveStatus } from "@/features/chat/ui/settings/save-status";

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

function SettingsLayout() {
  const { pathname } = useLocation();
  const sectionId = SECTION_IDS[pathname] ?? "overview";

  const links = [
    { to: "/settings/preferences", label: "Preferences" },
    { to: "/settings/profile", label: "Profile" },
    { to: "/onboarding", label: "Onboarding" },
    { to: "/settings/defaults", label: "Defaults" },
    { to: "/settings/providers", label: "Providers" },
    { to: "/settings/presets", label: "Presets" },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <PageHeader title="Settings" subtitle="Configure AI providers, presets, and defaults." />
      <div className="lg:flex lg:gap-10">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-2 lg:flex-col lg:w-44 lg:gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-2 hover:text-1 hover:bg-muted no-underline transition-colors"
              activeProps={{ className: "!text-brand-strong bg-brand/10 font-medium" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <SettingsSaveProvider activeSection={sectionId}>
          <div className="flex-1 max-w-2xl pt-4 lg:pt-0">
            {sectionId === "model" || sectionId === "display" ? (
              <div className="mb-4 flex min-h-5 items-center">
                <SettingsSaveStatus idleLabel="Changes save automatically" />
              </div>
            ) : null}
            <Outlet />
          </div>
        </SettingsSaveProvider>
      </div>
    </main>
  );
}
