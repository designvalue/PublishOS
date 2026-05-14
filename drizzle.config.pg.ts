import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema-pg.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/postgres",
  },
  casing: "snake_case",
});
