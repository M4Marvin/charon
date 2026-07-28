import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { username } from "better-auth/plugins/username";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { seedSampleData } from "@/server/seed";
import { ensureGlobalAiProviderExists } from "@/db/repositories/aiProviders";
import { FALLBACK_GLOBAL_PROVIDER } from "@/server/bootstrap";

const appUrl = process.env.APP_URL || "http://localhost:3000";
const extraOrigins = (process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl, "http://localhost:4173", ...extraOrigins],
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
        after: async (userData) => {
          const role = ((userData as Record<string, unknown>).role as string) ?? "user";
          await ensureGlobalAiProviderExists(FALLBACK_GLOBAL_PROVIDER);
          await seedSampleData(userData.id, role);
        },
      },
    },
  },
  plugins: [username(), admin({ defaultRole: "user" }), tanstackStartCookies()],
});
