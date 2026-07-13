"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { verifyLoginPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/login", "error", message);
}

export async function login(formData: FormData) {
  const loginId = formString(formData, "loginId");
  const password = formString(formData, "password");

  if (!loginId || !password) {
    await fail("아이디와 비밀번호를 입력하세요.");
  }

  const user = await prisma.user.findUnique({
    where: {
      loginId
    }
  });
  const passwordValid = verifyLoginPassword(password, user?.passwordHash);

  if (!user || !user.isActive || !passwordValid) {
    return fail("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  await createSession(user.id, user.sessionVersion);

  if (user.mustChangePassword) {
    redirect("/account/password" as never);
  }

  redirect("/");
}
