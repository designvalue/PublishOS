import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAuthPage =
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/invite/") ||
        path.startsWith("/forgot-password") ||
        path.startsWith("/reset-password/");
      // Published folder URLs are public — the route handler enforces its own
      // password gate. Don't require workspace auth.
      const isPublic = path.startsWith("/c/");

      if (isPublic) return true;

      if (isAuthPage) {
        if (isLoggedIn && (path.startsWith("/login") || path.startsWith("/register"))) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  providers,
} satisfies NextAuthConfig;
