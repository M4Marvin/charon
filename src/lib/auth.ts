import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { username } from "better-auth/plugins/username";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { seedSampleData } from "@/server/seed";

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl, "http://localhost:4173"],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 4,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const username = (user as Record<string, string>).username ?? "";
          await seedSampleData(user.id, username);
        },
      },
    },
  },
  plugins: [username(), tanstackStartCookies()],
});
