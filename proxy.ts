import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Must match `lib/auth.ts` — without `trustHost`, session cookies may not be
// trusted on Vercel and `authorized` sees no user while API routes still 401.
const { auth } = NextAuth({
  trustHost: true,
  ...authConfig,
});

export const proxy = auth;

// Skip the proxy for:
//  - NextAuth's own routes (`/api/auth/*`)
//  - Public versioned API (`/api/v1/*`) — these endpoints authenticate via
//    Bearer API token, not a session cookie. The proxy redirecting to
//    /login would break programmatic access entirely.
//  - Next.js internals (`/_next/static`, `/_next/image`)
//  - App-level icon assets that Next 16 auto-discovers and serves from
//    `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`. These URLs
//    (`/favicon.ico`, `/icon.png`, `/apple-icon.png`) are referenced by
//    `<link rel="icon">` tags in the document head, so they must load
//    BEFORE a session exists, otherwise tab/PWA icons fail.
//  - Public brand assets under `/brand/*` — logos must load on the login,
//    register, and password-gate screens BEFORE a session exists, so the
//    auth redirect can't sit in front of them.
export const config = {
  matcher: [
    "/((?!api/auth|api/v1/|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)",
  ],
};
