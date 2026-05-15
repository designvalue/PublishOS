/** Public demo deployment — https://publishosapp.designvalue.co/login */
export const DEMO_LOGIN_HOST = "publishosapp.designvalue.co";

export const DEMO_LOGIN_EMAIL = "demo@designvalue.co";
export const DEMO_LOGIN_PASSWORD = "designvalue";

/** True only on the Design Value demo host (or an explicit NEXT_PUBLIC_DEMO_LOGIN_HOST match). */
export function isDemoLoginDeployment(hostname: string): boolean {
  if (hostname === DEMO_LOGIN_HOST) return true;
  const configured = process.env.NEXT_PUBLIC_DEMO_LOGIN_HOST?.trim();
  return !!configured && hostname === configured;
}
