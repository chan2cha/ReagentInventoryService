"use server";

import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSession, encodeSession } from "@/lib/session-token";
import { isRoleAllowed } from "@/lib/access";

const SESSION_COOKIE = "reagent_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

export type CurrentUser = {
  id: string;
  loginId: string;
  email: string | null;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }

  return "local-development-auth-secret";
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);

  cookieStore.set(SESSION_COOKIE, encodeSession({ userId, expiresAt: expires.getTime() }, authSecret()), {
    expires,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!session) {
    return null;
  }

  const payload = decodeSession(session, authSecret());

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      isActive: true
    },
    select: {
      id: true,
      loginId: true,
      email: true,
      name: true,
      role: true,
      mustChangePassword: true
    }
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login" as never);
  }

  return user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireUser();

  if (!isRoleAllowed(user.role, allowedRoles)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requirePageRole(allowedRoles: UserRole[]) {
  const user = await requireUser();
  if (!isRoleAllowed(user.role, allowedRoles)) redirect("/access-denied" as never);
  return user;
}

export async function logout() {
  await clearSession();
  redirect("/login" as never);
}
