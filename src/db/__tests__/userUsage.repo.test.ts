import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, seedTestUser, type TestDb } from "@/db/__tests__/helpers";
import { incrementToday, getTodayCount, todayUTC } from "@/db/repositories/userUsage";

describe("userUsage repository", () => {
  let db: TestDb;

  beforeEach(() => {
    db = makeTestDb().db;
  });

  describe("todayUTC", () => {
    it("returns a valid YYYY-MM-DD string", () => {
      const day = todayUTC();
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getTodayCount", () => {
    it("returns 0 when no rows exist", () => {
      const userId = seedTestUser(db);
      expect(getTodayCount(userId, db)).toBe(0);
    });
  });

  describe("incrementToday", () => {
    it("returns 1 on first call, 2 on second, 3 on third", () => {
      const userId = seedTestUser(db);
      expect(incrementToday(userId, db)).toBe(1);
      expect(incrementToday(userId, db)).toBe(2);
      expect(incrementToday(userId, db)).toBe(3);
    });

    it("tracks different users independently", () => {
      const u1 = seedTestUser(db, "user-a");
      const u2 = seedTestUser(db, "user-b");
      expect(incrementToday(u1, db)).toBe(1);
      expect(incrementToday(u1, db)).toBe(2);
      expect(incrementToday(u2, db)).toBe(1);
      expect(incrementToday(u2, db)).toBe(2);
      expect(incrementToday(u1, db)).toBe(3);
    });

    it("getTodayCount reflects incrementToday", () => {
      const userId = seedTestUser(db);
      incrementToday(userId, db);
      incrementToday(userId, db);
      expect(getTodayCount(userId, db)).toBe(2);
    });
  });
});
