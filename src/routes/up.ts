import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { access, constants, stat } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/db";
import { UPLOADS_DISK_ROOT, UPLOADS_PUBLIC_PREFIX } from "@/server/private-fs";

async function checkDatabase(): Promise<string | null> {
  try {
    db.run(sql`SELECT 1`);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function checkUploadsDir(): Promise<string | null> {
  try {
    const dir = join(UPLOADS_DISK_ROOT, UPLOADS_PUBLIC_PREFIX);
    const stats = await stat(dir);
    if (!stats.isDirectory()) return `${dir} is not a directory`;
    await access(dir, constants.W_OK);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export const Route = createFileRoute("/up")({
  server: {
    handlers: {
      GET: async () => {
        const [database, uploads] = await Promise.all([checkDatabase(), checkUploadsDir()]);

        const checks: Record<string, string> = {};
        if (database) checks.database = database;
        if (uploads) checks.uploads = uploads;

        const healthy = Object.keys(checks).length === 0;

        return new Response(
          JSON.stringify({
            status: healthy ? "ok" : "error",
            ...(healthy ? {} : { checks }),
          }),
          {
            status: healthy ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
