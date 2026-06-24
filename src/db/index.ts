import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
export type DB = BetterSQLite3Database<typeof schema>;
export { schema };
