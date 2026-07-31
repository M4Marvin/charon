import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanstackQueryProvider from "../integrations/tanstack-query/root-provider";

import Header from "@/components/Header";
import { EmptyState } from "@/components/common/EmptyState";
import { TriangleAlert, Compass } from "lucide-react";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { DemoBanner } from "@/components/common/DemoBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { RichTextSettingsProvider } from "@/lib/richtext-settings";
import { getSession } from "@/lib/auth.functions";
import type { User } from "@/db/schema";

interface MyRouterContext {
  queryClient: QueryClient;
  user?: User;
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div className="flex h-dvh items-center justify-center bg-base">
      <EmptyState icon={TriangleAlert} title="Something went wrong" description={error.message}>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-brand hover:underline cursor-pointer"
        >
          Reload page
        </button>
      </EmptyState>
    </div>
  );
}

function RootNotFoundComponent() {
  return (
    <div className="flex h-dvh items-center justify-center bg-base">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist."
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
  beforeLoad: async ({ location }) => {
    const publicPrefixes = ["/", "/signin", "/signup"];
    const isApiRoute = location.pathname.startsWith("/api/");
    const isAssetRoute = location.pathname.startsWith("/assets/");
    if (
      publicPrefixes.some(
        (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
      ) ||
      isApiRoute ||
      isAssetRoute
    )
      return;

    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/signin" });
    }
    return { user: session.user as User };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Charon",
      },
      {
        name: "description",
        content:
          "A modern self-hosted AI character chat platform. Import V2 character cards, build lorebooks, connect any LLM provider, and chat with branching narratives.",
      },
      {
        property: "og:site_name",
        content: "Charon",
      },
      {
        property: "og:title",
        content: "Charon",
      },
      {
        property: "og:description",
        content:
          "Import character cards, build lorebooks, connect any LLM provider, and have immersive branching conversations.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:image",
        content: "/logo512.png",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "twitter:title",
        content: "Charon",
      },
      {
        name: "twitter:description",
        content:
          "Self-hosted AI character chat. Import character cards, build lorebooks, connect any LLM provider.",
      },
      {
        name: "twitter:image",
        content: "/logo512.png",
      },
      {
        name: "theme-color",
        content: "#0a1418",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/logo.svg",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "apple-touch-icon",
        href: "/logo192.png",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient, user } = Route.useRouteContext();
  const location = useLocation();
  const hideGlobalHeader =
    /^\/chat\//.test(location.pathname) || /^\/c\/(?!new$)[^/]+$/.test(location.pathname);
  const isAuthed = Boolean(user);
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          {!hideGlobalHeader && <Header />}
          {!hideGlobalHeader && isAuthed && user?.role !== "admin" && <DemoBanner />}
          <div className={isAuthed && !hideGlobalHeader ? "pb-20 md:pb-0" : undefined}>
            <RichTextSettingsProvider>
              <TanstackQueryProvider queryClient={queryClient}>{children}</TanstackQueryProvider>
            </RichTextSettingsProvider>
          </div>
          {isAuthed && !hideGlobalHeader && <MobileTabBar />}
          <Toaster />
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
          <Scripts />
        </TooltipProvider>
      </body>
    </html>
  );
}
