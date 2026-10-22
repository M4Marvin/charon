import { useEffect } from "react";
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ThemeProvider } from "next-themes";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanstackQueryProvider from "../integrations/tanstack-query/root-provider";

import Header from "@/components/Header";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TriangleAlert, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { CommandMenu } from "@/components/common/CommandMenu";
import { NewSheet } from "@/components/common/NewSheet";
import { PageTransition, RouteProgress } from "@/components/common/PageTransition";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { RichTextSettingsProvider } from "@/lib/richtext-settings";
import { getSession } from "@/lib/auth.functions";
import { getOnboardingStatus } from "@/server/fns/onboarding";
import { redirectTargetForPath } from "@/features/onboarding/onboarding-gate";
import type { User } from "@/db/schema";

interface MyRouterContext {
  queryClient: QueryClient;
  user?: User;
}

function RootErrorComponent(_props: ErrorComponentProps) {
  return (
    <div className="flex h-dvh items-center justify-center bg-base">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="The page couldn’t be rendered. Reloading usually fixes it."
      >
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button asChild variant="ghost">
            <Link to="/chat">Back to chats</Link>
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}

function RootNotFoundComponent() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-base pb-20 md:pb-0">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist."
      >
        <Button asChild variant="outline">
          <Link to="/chat">Back to chats</Link>
        </Button>
      </EmptyState>
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
  beforeLoad: async ({ location }) => {
    const publicPrefixes = ["/", "/signin", "/setup", "/up"];
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
    const status = await getOnboardingStatus();
    const target = redirectTargetForPath(location.pathname, status);
    if (target) {
      throw redirect({ to: target });
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
        content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
      },
      {
        title: "Charon",
      },
      {
        name: "description",
        content:
          "Charon is a self-hosted chat app for stories and roleplay. Import character cards, bring your own model, and keep every branching conversation on your own computer.",
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
          "A private home for your AI characters. Self-hosted, branching conversations, your cards and your model.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "https://chat.m4marvin.com",
      },
      {
        property: "og:image",
        content: "https://chat.m4marvin.com/og.png",
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
        content: "https://chat.m4marvin.com/og.png",
      },
      {
        name: "theme-color",
        content: "#0a1418",
      },
    ],
    links: [
      {
        rel: "preload",
        href: "/fonts/fraunces-500-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "canonical",
        href: "https://chat.m4marvin.com",
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

const DOCUMENT_TITLES: Array<[RegExp, string]> = [
  [/^\/$/, "Charon — a private home for your AI characters"],
  [/^\/signin$/, "Sign in · Charon"],
  [/^\/setup$/, "Create owner account · Charon"],
  [/^\/onboarding$/, "Set up Charon · Charon"],
  [/^\/chat$/, "Chats · Charon"],
  [/^\/chat\/[^/]+$/, "Chat · Charon"],
  [/^\/characters$/, "Characters · Charon"],
  [/^\/characters\/new$/, "Import character · Charon"],
  [/^\/characters\/[^/]+\/edit$/, "Edit character · Charon"],
  [/^\/characters\/[^/]+$/, "Character · Charon"],
  [/^\/lorebooks$/, "Lorebooks · Charon"],
  [/^\/lorebooks\/new$/, "New lorebook · Charon"],
  [/^\/lorebooks\/[^/]+$/, "Lorebook · Charon"],
  [/^\/settings\/preferences$/, "Preferences · Settings · Charon"],
  [/^\/settings\/profile$/, "Profile · Settings · Charon"],
  [/^\/settings\/defaults$/, "AI defaults · Settings · Charon"],
  [/^\/settings\/providers$/, "Providers · Settings · Charon"],
  [/^\/settings\/presets$/, "Presets · Settings · Charon"],
];

function DocumentTitle() {
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(() => {
    const match = DOCUMENT_TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match?.[1] ?? "Page not found · Charon";
  }, [pathname]);
  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient, user } = Route.useRouteContext();
  const location = useLocation();
  const hideGlobalHeader =
    location.pathname === "/" ||
    location.pathname === "/signin" ||
    location.pathname === "/setup" ||
    location.pathname.startsWith("/chat/") ||
    /^\/c\/(?!new$)[^/]+$/.test(location.pathname) ||
    location.pathname === "/onboarding";
  const isAuthed = Boolean(user);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["dark"]}
          enableSystem={false}
          enableColorScheme
        >
          <TooltipProvider>
            <ErrorBoundary>
              {!hideGlobalHeader && <Header />}
              <div
                className={
                  isAuthed && !hideGlobalHeader
                    ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
                    : undefined
                }
              >
                <RichTextSettingsProvider>
                  <TanstackQueryProvider queryClient={queryClient}>
                    <PageTransition>{children}</PageTransition>
                  </TanstackQueryProvider>
                </RichTextSettingsProvider>
              </div>
              <RouteProgress />
              <DocumentTitle />
              {isAuthed && !hideGlobalHeader && <MobileTabBar />}
              {isAuthed && <CommandMenu />}
              {isAuthed && <NewSheet />}
              <Toaster />
            </ErrorBoundary>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
