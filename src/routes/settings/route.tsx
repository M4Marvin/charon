import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  const links = [
    { to: "/settings/preferences", label: "Preferences" },
    { to: "/settings/profile", label: "Profile" },
    ...(isAdmin ? [
      { to: "/settings/providers", label: "Providers" },
      { to: "/settings/presets", label: "Presets" },
      { to: "/settings/demo", label: "Demo Provider" },
    ] : []),
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
        <div className="flex-1 max-w-2xl pt-4 lg:pt-0">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
