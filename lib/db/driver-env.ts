import "server-only";

function isNextJsBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build"
  );
}

/**
 * Use Neon/Postgres when `DATABASE_URL` is a postgres URL — except during
 * `next build` page-data collection. There we use SQLite so the build does not
 * depend on Neon credentials/network (and migrations are not applied against
 * production from CI). Server runtime still uses Neon when `DATABASE_URL` is set.
 */
export function usePostgres(): boolean {
  if (isNextJsBuildPhase()) return false;
  const u = process.env.DATABASE_URL?.trim();
  if (!u) return false;
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}
