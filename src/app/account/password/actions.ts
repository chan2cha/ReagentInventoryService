"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/account/password?error=${encodeURIComponent(message)}` as never);
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!currentPassword || !newPassword || !confirmPassword) {
    fail("현재 비밀번호와 새 비밀번호를 모두 입력하세요.");
  }

  if (newPassword.length < 8) {
    fail("새 비밀번호는 8자 이상이어야 합니다.");
  }

  if (newPassword !== confirmPassword) {
    fail("새 비밀번호 확인이 일치하지 않습니다.");
  }

  if (currentPassword === newPassword) {
    fail("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
  }

  const dbUser = await prisma.user.findUnique({
    where: {
      id: user.id
    },
    select: {
      passwordHash: true
    }
  });

  if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
    fail("현재 비밀번호가 올바르지 않습니다.");
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false
    }
  });

  revalidatePath("/");
  revalidatePath("/account/password");
  redirect("/");
}
