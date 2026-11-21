import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const isGoogleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: isGoogleAuthEnabled ? [Google] : [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (typeof user?.tokenVersion === "number") {
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.tokenVersion === "number") {
          session.user.tokenVersion = token.tokenVersion;
        }
      }
      return session;
    },
  },
};
