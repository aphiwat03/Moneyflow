import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import {
  authAccounts,
  authSessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { seedDefaultDataForUser } from "@/db/seed";
import { canOAuthSignIn } from "@/lib/auth-policy";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            passwordHash: users.passwordHash,
            tokenVersion: users.tokenVersion,
          })
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider && account.provider !== "credentials") {
        const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
        if (!normalizedEmail) {
          return false;
        }

        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        return canOAuthSignIn({
          email: normalizedEmail,
          hasExistingAccount: existing.length > 0,
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        if (typeof user.tokenVersion === "number") {
          token.tokenVersion = user.tokenVersion;
        } else {
          try {
            const [row] = await db
              .select({ tokenVersion: users.tokenVersion })
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);
            token.tokenVersion = row?.tokenVersion ?? 1;
          } catch {
            token.tokenVersion = 1;
          }
        }
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await seedDefaultDataForUser(db, user.id);
      }
    },
  },
});
