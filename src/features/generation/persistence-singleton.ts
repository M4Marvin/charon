import { db } from "@/db";
import { createSqlitePersistence } from "./persistence";

export const aiPersistence = createSqlitePersistence(db);
