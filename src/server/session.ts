import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

let didBootstrap = false;

async function bootstrap() {
  if (didBootstrap) return;
  didBootstrap = true;
  const { ensureUsers } = await import("@/server/bootstrap");
  await ensureUsers();
}

void bootstrap();

/**
 * Resolve the current session inside a server function / loader.
 *
 * Must be called within a request context (inside `createServerFn` handlers
 * or route loaders).
 *
 * Throws if no valid session exists.
 */
export async function getSession() {
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
  const headers = getRequest().headers;
  return await auth.api.getSession({ headers });
}
