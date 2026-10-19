import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { username } from "better-auth/plugins/username";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { seedSampleData } from "@/server/seed";

const port = process.env.PORT || "3000";
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const extraOrigins = (process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
// Treat both loopback spellings as the same local origin. better-auth checks
// the Origin header on cookie POSTs, and localhost !== 127.0.0.1.
const localOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [...localOrigins, appUrl, "http://localhost:4173", ...extraOrigins],
  // Secure cookies whenever the configured public URL is HTTPS. Plain-HTTP
  // localhost/LAN installs keep working, but a public deployment gets the flag.
  advanced: {
    useSecureCookies: appUrl.trim().toLowerCase().startsWith("https://"),
  },
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const existing = db.select({ id: user.id }).from(user).limit(1).get();
          if (existing) {
            throw new Error("This instance already has an account");
          }
        },
        after: async (userData) => {
          await seedSampleData(userData.id);
        },
      },
    },
  },
  plugins: [username(), tanstackStartCookies()],
});
