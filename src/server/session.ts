// Session helpers — currently a stub that always returns a hardcoded default
// user. The auth machinery is wired (see `src/lib/auth.ts`, better-auth +
// drizzle adapter) but the session resolution itself is bypassed so the app
// can be used without a sign-in flow while auth UX is built.
//
// The `default-user` row must exist in the DB (created by
// `scripts/migrate-data.ts` via `ensureDefaultUser()`) before any server
// function or API route is called, since the `characters` / `lorebooks` / etc.
// tables FK-reference it.
//
// When real auth lands, restore the original `getSession` body that calls
// `auth.api.getSession({ headers: request.headers })` and re-add the
// `import { auth } from "@/lib/auth"` line.

import { getRequest } from "@tanstack/react-start/server";

const DEFAULT_USER_ID = "default-user";

const defaultUser = {
  id: DEFAULT_USER_ID,
  name: "Default User",
  email: "default@st-v2.local",
  emailVerified: true as const,
  image: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const defaultSession = {
  id: "default-session",
  token: "default-session-token",
  userId: DEFAULT_USER_ID,
  expiresAt: new Date("2099-12-31T23:59:59Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ipAddress: null as string | null,
  userAgent: null as string | null,
};

/**
 * Resolve the current session inside a server function / loader.
 *
 * Currently a no-op stub: always returns the hardcoded default user/session.
 * Server functions and API routes that need the current userId can call this
 * without try/catch.
 *
 * Must be called within a request context (inside `createServerFn` handlers
 * or route loaders). The `getRequest()` call is preserved for future
 * re-wiring — the call is otherwise unused today.
 */
export async function getSession() {
  getRequest();
  return { user: defaultUser, session: defaultSession };
}

/**
 * Resolve the current session or return `null` if unauthenticated.
 *
 * Currently returns the default session unconditionally. Will be re-wired to
 * return `null` for anonymous users when real auth lands.
 */
export async function tryGetSession() {
  getRequest();
  return { user: defaultUser, session: defaultSession };
}
