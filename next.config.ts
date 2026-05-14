import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addon; keep external so Turbopack does not bundle/trace it incorrectly.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
