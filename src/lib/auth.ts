import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { username } from "better-auth/plugins/username";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { seedSampleData } from "@/server/seed";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await seedSampleData(user.id);
        },
      },
    },
  },
  plugins: [username(), tanstackStartCookies()],
});
