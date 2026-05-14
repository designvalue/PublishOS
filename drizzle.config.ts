import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const path = process.env.DATABASE_PATH ?? "publishos.db";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema-sqlite.ts",
  out: "./drizzle",
  dbCredentials: { url: path },
  casing: "snake_case",
});
