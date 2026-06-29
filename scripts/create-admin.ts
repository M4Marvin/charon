import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

config({ path: [".env.local", ".env"] });

function parseArgs(): { username: string; email: string; password: string } {
  const args = process.argv.slice(2);
  let username = "";
  let email = "";
  let password = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--username" && i + 1 < args.length) {
      username = args[++i];
    } else if (args[i] === "--email" && i + 1 < args.length) {
      email = args[++i];
    } else if (args[i] === "--password" && i + 1 < args.length) {
      password = args[++i];
    }
  }

  if (!username || !email || !password) {
    console.error("Usage: pnpm create-admin --username <name> --email <email> --password <password>");
    process.exit(1);
  }

  return { username, email, password };
}

async function main() {
  const { username, email, password } = parseArgs();

  const { db } = await import("@/db");
  const { account, user } = await import("@/db/schema");

  const existing = db.select({ id: user.id }).from(user).where(eq(user.username, username)).get();

  if (existing) {
    db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id)).run();
    console.log(`✅ User "${username}" promoted to admin.`);
    return;
  }

  const userId = randomUUID();
  const hashedPw = await hashPassword(password);

  db.insert(user).values({
    id: userId,
    name: username,
    email,
    username,
    role: "admin",
  }).run();

  db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashedPw,
  }).run();

  const { seedSampleData } = await import("@/server/seed");
  await seedSampleData(userId, "admin");

  console.log(`✅ Admin user "${username}" created.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
