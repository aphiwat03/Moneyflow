import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
}

type SessionResolution =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "revoked" }
  | { status: "unauthenticated" };

const resolveSessionState = cache(async (): Promise<SessionResolution> => {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "unauthenticated" };
  }

  const jwtTokenVersion =
    typeof session.user.tokenVersion === "number"
      ? session.user.tokenVersion
      : 1;

  try {
    const [dbUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!dbUser || dbUser.tokenVersion !== jwtTokenVersion) {
      return { status: "revoked" };
    }

    return {
      status: "authenticated",
      user: {
        id: dbUser.id,
        name: dbUser.name ?? null,
        email: dbUser.email,
      },
    };
  } catch (error) {
    console.error("[session] tokenVersion verification error:", error);
    // In production, fail closed if session state cannot be verified against DB.
    if (process.env.NODE_ENV === "production") {
      return { status: "unauthenticated" };
    }
    // In local dev, preserve DatabaseConnectionWarning UX if Postgres container is stopped.
    return {
      status: "authenticated",
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? "",
      },
    };
  }
});

export async function getOptionalUser(): Promise<CurrentUser | null> {
  const result = await resolveSessionState();
  return result.status === "authenticated" ? result.user : null;
}

export async function requireUser(): Promise<CurrentUser> {
  const result = await resolveSessionState();
  if (result.status === "revoked") {
    redirect("/api/auth/session-expired");
  }
  if (result.status !== "authenticated") {
    redirect("/login");
  }
  return result.user;
}
