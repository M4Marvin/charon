import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { seedSampleData } from "@/server/seed";

const DEMO_USERS = [
  { username: "marv", password: "marv123", name: "Marv" },
  { username: "demo", password: "demo123", name: "Demo" },
];

export async function ensureUsers(): Promise<void> {
  for (const u of DEMO_USERS) {
    const existing = db.select().from(user).where(eq(user.username, u.username)).get();
    if (existing) continue;

    const userId = randomUUID();
    const passwordHash = await hashPassword(u.password);

    db.insert(user).values({
      id: userId,
      name: u.name,
      email: `${u.username}@demo.local`,
      emailVerified: true,
      username: u.username,
      displayUsername: u.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    db.insert(account).values({
      id: randomUUID(),
      accountId: `${u.username}@demo.local`,
      providerId: "email",
      userId,
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    await seedSampleData(userId);
  }
}
