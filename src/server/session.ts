import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

let didBootstrap = false;

async function bootstrap() {
  if (didBootstrap) return;
  didBootstrap = true;
  try {
    const { ensureGlobalProvider } = await import("@/server/bootstrap");
    await ensureGlobalProvider();
  } catch (e) {
    console.error("[bootstrap] failed:", e);
  }
}

/**
 * Returns true if the user has admin role.
 */
export function isAdmin(user: { role?: string | null }): boolean {
  return user.role === "admin";
}

/**
 * Resolve the current session inside a server function / loader.
 *
 * Must be called within a request context (inside `createServerFn` handlers
 * or route loaders).
 *
 * Throws if no valid session exists.
 */
export async function getSession() {
  await bootstrap();
  const headers = getRequest().headers;
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Unauthorized");
  return session;
}

/**
 * Resolve the current session or return `null` if unauthenticated.
 *
 * Must be called within a request context.
 */
export async function tryGetSession() {
  await bootstrap();
  const headers = getRequest().headers;
  return await auth.api.getSession({ headers });
}
