/**
 * The "owner" role is displayed as "Super Admin" throughout the UI.
 * The internal identifier stays as `"owner"` so existing data, foreign keys,
 * and code paths continue to work without a migration.
 */

export const OWNER_LABEL = "Super Admin";

export function roleDisplay(role: string): string {
  if (role === "owner") return OWNER_LABEL;
  return role.charAt(0).toUpperCase() + role.slice(1);
}
