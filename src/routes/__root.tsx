import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanstackQueryProvider from "../integrations/tanstack-query/root-provider";

import Header from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { RichTextSettingsProvider } from "@/lib/richtext-settings";
import { getSession } from "@/lib/auth.functions";

interface MyRouterContext {
  queryClient: QueryClient;
  user?: { id: string; name: string; email: string };
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
    const publicPaths = ["/", "/signin", "/signup"];
    const isApiRoute = location.pathname.startsWith("/api/");
    const isAssetRoute = location.pathname.startsWith("/assets/");
    if (publicPaths.includes(location.pathname) || isApiRoute || isAssetRoute) return;

    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/signin" });
    }
    return { user: session.user as { id: string; name: string; email: string } };
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
        title: "ST V2.0",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  // The chat page renders its own fixed header (back chevron / character
  // name / gear). Hide the global nav there so it doesn't double up.
  const hideGlobalHeader =
    /^\/chats\/[^/]+/.test(location.pathname) ||
    /^\/c\/(?!new$)[^/]+$/.test(location.pathname);
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          {!hideGlobalHeader && <Header />}
          <RichTextSettingsProvider>
            <TanstackQueryProvider queryClient={queryClient}>{children}</TanstackQueryProvider>
          </RichTextSettingsProvider>
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
