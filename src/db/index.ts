import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

let _db: BetterSQLite3Database<typeof schema> | undefined;

export const db = new Proxy<BetterSQLite3Database<typeof schema>>(
  {} as any,
  {
    get(_, p) {
      if (!_db) _db = drizzle(process.env.DATABASE_URL!, { schema });
      const v = Reflect.get(_db, p, _db);
      return typeof v === "function" ? v.bind(_db) : v;
    },
  },
);

export type DB = BetterSQLite3Database<typeof schema>;
export { schema };
