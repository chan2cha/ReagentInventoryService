"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, requireUser } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/account/password", "error", message);
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!currentPassword || !newPassword || !confirmPassword) {
    await fail("현재 비밀번호와 새 비밀번호를 모두 입력하세요.");
  }

  if (newPassword.length < 8) {
    await fail("새 비밀번호는 8자 이상이어야 합니다.");
  }

  if (newPassword !== confirmPassword) {
    await fail("새 비밀번호 확인이 일치하지 않습니다.");
  }

  if (currentPassword === newPassword) {
    await fail("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
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
    await fail("현재 비밀번호가 올바르지 않습니다.");
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      sessionVersion: {
        increment: 1
      }
    },
    select: {
      id: true,
      sessionVersion: true
    }
  });
  await createSession(updatedUser.id, updatedUser.sessionVersion);

  revalidatePath("/");
  revalidatePath("/account/password");
  redirect("/");
}
