import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addon; keep external so Turbopack does not bundle/trace it incorrectly.
  serverExternalPackages: ["better-sqlite3"],
  // Drizzle reads migration SQL at runtime; ensure it is copied into the serverless trace.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*.sql", "./drizzle/meta/**/*"],
  },
};

export default nextConfig;
