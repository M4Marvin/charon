import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

/**
 * Resolve the current session inside a server function / loader.
 *
 * Reads the request cookie via better-auth and returns the full session
 * payload (`{ user, session }`). Throws `Unauthorized` if no valid session
 * is present.
 *
 * Must be called within a request context (inside `createServerFn` handlers
 * or route loaders). Calling outside a request throws.
 */
export async function getSession() {
  const request = getRequest();
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result) throw new Error("Unauthorized");
  return result;
}

/**
 * Resolve the current session or return `null` if unauthenticated.
 * Use this in route loaders that should work for both signed-in and
 * signed-out users; use `getSession()` in server fns that mutate.
 */
export async function tryGetSession() {
  const request = getRequest();
  return auth.api.getSession({ headers: request.headers });
}
