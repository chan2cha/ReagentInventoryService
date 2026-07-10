"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}` as never);
}

export async function login(formData: FormData) {
  const loginId = formString(formData, "loginId");
  const password = formString(formData, "password");

  if (!loginId || !password) {
    fail("아이디와 비밀번호를 입력하세요.");
  }

  const user = await prisma.user.findUnique({
    where: {
      loginId
    }
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    fail("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  await createSession(user.id);

  if (user.mustChangePassword) {
    redirect("/account/password" as never);
  }

  redirect("/");
}
