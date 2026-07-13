import "server-only";

/** 세션 쿠키를 검증하고 페이지·서버 액션에서 사용할 현재 사용자를 제공한다. */

import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { decodeSession, encodeSession } from "@/lib/session-token";
import { isRoleAllowed } from "@/lib/access";

const SESSION_COOKIE = "reagent_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const DEVELOPMENT_AUTH_SECRET = "local-development-auth-secret";
const AUTH_SECRET_MIN_LENGTH = 32;

export type CurrentUser = {
  id: string;
  loginId: string;
  email: string | null;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
};

function isProductionEnvironment() {
  return [process.env.NODE_ENV, process.env.APP_ENV, process.env.VERCEL_ENV]
    .some((value) => value?.trim().toLowerCase() === "production");
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;

  if (isProductionEnvironment()) {
    const normalized = secret?.trim().toLowerCase() ?? "";
    const placeholder = normalized.includes("replace-with") ||
      normalized === DEVELOPMENT_AUTH_SECRET;

    if (!secret || secret.trim().length < AUTH_SECRET_MIN_LENGTH || placeholder) {
      throw new Error(
        `AUTH_SECRET must be a non-placeholder secret of at least ${AUTH_SECRET_MIN_LENGTH} characters in production.`
      );
    }
  }

  return secret || DEVELOPMENT_AUTH_SECRET;
}

export async function createSession(userId: string, sessionVersion: number) {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);

  cookieStore.set(SESSION_COOKIE, encodeSession({
    userId,
    sessionVersion,
    expiresAt: expires.getTime()
  }, authSecret()), {
    expires,
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionEnvironment(),
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// 한 서버 렌더링 안에서 여러 권한 검사가 발생해도 사용자 조회는 한 번만 수행한다.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
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
      isActive: true,
      sessionVersion: payload.sessionVersion
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
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login" as never);
  }

  return user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireUser();

  if (user.mustChangePassword) {
    throw new Error("PASSWORD_CHANGE_REQUIRED");
  }

  if (!isRoleAllowed(user.role, allowedRoles)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requirePageRole(allowedRoles: UserRole[]) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/account/password" as never);
  if (!isRoleAllowed(user.role, allowedRoles)) redirect("/access-denied" as never);
  return user;
}
