import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "@/lib/env";
import * as schema from "./schema";

const sqlite = new Database(env.DATABASE_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
