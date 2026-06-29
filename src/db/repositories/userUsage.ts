import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DB } from "@/db";
import { userDailyUsage } from "@/db/schema";

export const DAILY_LIMIT = 100;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function incrementToday(
  userId: string,
  db: DB = defaultDb,
): number {
  const day = todayUTC();
  const row = db
    .insert(userDailyUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [userDailyUsage.userId, userDailyUsage.day],
      set: { count: sql`count + 1` },
    })
    .returning({ count: userDailyUsage.count })
    .get();
  return row.count;
}

export function getTodayCount(
  userId: string,
  db: DB = defaultDb,
): number {
  const day = todayUTC();
  const row = db
    .select({ count: userDailyUsage.count })
    .from(userDailyUsage)
    .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.day, day)))
    .get();
  return row?.count ?? 0;
}
