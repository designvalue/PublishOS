import "server-only";

/** When set to a `postgres://` or `postgresql://` URL (e.g. Neon), the app uses Postgres instead of SQLite. */
export function usePostgres(): boolean {
  const u = process.env.DATABASE_URL?.trim();
  if (!u) return false;
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}
