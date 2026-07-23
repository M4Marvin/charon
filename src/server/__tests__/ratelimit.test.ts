import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb, type TestSqlite } from "@/db/__tests__/helpers";
import { DAILY_LIMIT, incrementToday } from "@/db/repositories/userUsage";
import { checkRateLimit, msUntilNextUTCMidnight } from "@/server/ratelimit";

describe("ratelimit", () => {
  let db: TestDb;
  let sqlite: TestSqlite;

  beforeEach(() => {
    const ctx = makeTestDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe("msUntilNextUTCMidnight", () => {
    it("returns a positive number of milliseconds", () => {
      const ms = msUntilNextUTCMidnight();
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(86_400_000);
    });
  });

  describe("checkRateLimit", () => {
    it("bypasses admin users regardless of usage", () => {
      const userId = seedTestUser(db);
      const adminUser = { id: userId, role: "admin" };

      for (let i = 0; i < DAILY_LIMIT + 5; i++) {
        incrementToday(userId, db);
      }

      const result = checkRateLimit(adminUser, db);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("allows user under the daily limit", () => {
      const userId = seedTestUser(db);
      const user = { id: userId, role: "user" };

      const result = checkRateLimit(user, db);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it("increments count on each allowed check", () => {
      const userId = seedTestUser(db);
      const user = { id: userId, role: "user" };

      // Each call increments and returns allowed=true until we hit the limit
      let allowedCount = 0;
      for (let i = 0; i < DAILY_LIMIT; i++) {
        const result = checkRateLimit(user, db);
        if (result.allowed) allowedCount++;
      }
      expect(allowedCount).toBe(DAILY_LIMIT);
    });

    it("rejects user over the daily limit", () => {
      const userId = seedTestUser(db);
      const user = { id: userId, role: "user" };

      // Exhaust the limit
      for (let i = 0; i < DAILY_LIMIT; i++) {
        checkRateLimit(user, db);
      }

      // Next call should be rejected
      const result = checkRateLimit(user, db);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(86_400_000);
    });
  });
});
