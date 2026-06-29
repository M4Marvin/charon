import type { DB } from "@/db";
import { DAILY_LIMIT, incrementToday } from "@/db/repositories/userUsage";
import { isAdmin } from "@/server/session";

export { DAILY_LIMIT };

export function msUntilNextUTCMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime() - now.getTime();
}

export function checkRateLimit(
  user: { role?: string | null; id: string },
  db?: DB,
): { allowed: boolean; retryAfterMs: number } {
  if (isAdmin(user)) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const newCount = incrementToday(user.id, db);

  if (newCount > DAILY_LIMIT) {
    return { allowed: false, retryAfterMs: msUntilNextUTCMidnight() };
  }

  return { allowed: true, retryAfterMs: 0 };
}
