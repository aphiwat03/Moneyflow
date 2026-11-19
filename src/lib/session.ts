import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
}

export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? "",
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
