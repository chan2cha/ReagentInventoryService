"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const allowedRoles: UserRole[] = ["ADMIN", "ORDER_MANAGER", "SHIPMENT_MANAGER", "VIEWER"];

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/users", "error", message);
}

export async function createUser(formData: FormData) {
  try {
    const currentUser = await requireRole(["ADMIN"]);

    const loginId = formString(formData, "loginId");
    const name = formString(formData, "name");
    const email = formString(formData, "email");
    const password = formString(formData, "password");
    const role = formString(formData, "role") as UserRole;

    if (!loginId || !/^[a-zA-Z0-9._-]{3,32}$/.test(loginId)) {
      await fail("아이디는 영문, 숫자, 점, 밑줄, 하이픈 조합 3~32자로 입력하세요.");
    }

    if (!name) {
      await fail("사용자 이름을 입력하세요.");
    }

    if (password.length < 8) {
      await fail("임시 비밀번호는 8자 이상이어야 합니다.");
    }

    if (!allowedRoles.includes(role)) {
      await fail("사용자 역할을 선택하세요.");
    }

    const duplicate = await prisma.user.findUnique({
      where: {
        loginId
      }
    });

    if (duplicate) {
      await fail("이미 사용 중인 아이디입니다.");
    }

    if (email) {
      const duplicateEmail = await prisma.user.findUnique({
        where: {
          email
        }
      });

      if (duplicateEmail) {
        await fail("이미 등록된 이메일입니다.");
      }
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {
        loginId,
        email: email || null,
        name,
        passwordHash: hashPassword(password),
        mustChangePassword: true,
        role,
        isActive: true
      } });
      await tx.auditLog.create({ data: { action: "USER_CREATE", entityType: "USER", entityId: user.id, description: `사용자 ${loginId} 등록`, actorId: currentUser.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("사용자 관리 권한이 없습니다.");
    }

    throw error;
  }

  revalidatePath("/users");
  await redirectWithFlash("/users", "success", "사용자가 등록되었습니다.");
}

export async function toggleUserActive(formData: FormData) {
  const userId = formString(formData, "userId");

  if (!userId) {
    await fail("처리할 사용자를 찾을 수 없습니다.");
  }

  try {
    const currentUser = await requireRole(["ADMIN"]);

    if (currentUser.id === userId) {
      await fail("현재 로그인한 계정은 비활성화할 수 없습니다.");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        isActive: true
      }
    });

    if (!user) return fail("사용자를 찾을 수 없습니다.");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: !user.isActive,
          ...(user.isActive
            ? { sessionVersion: { increment: 1 } }
            : {})
        }
      });
      await tx.auditLog.create({ data: { action: user.isActive ? "USER_DEACTIVATE" : "USER_ACTIVATE", entityType: "USER", entityId: user.id, description: `사용자 계정 ${user.isActive ? "비활성화" : "활성화"}`, actorId: currentUser.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("사용자 관리 권한이 없습니다.");
    }

    throw error;
  }

  revalidatePath("/users");
  await redirectWithFlash("/users", "success", "사용자 상태가 변경되었습니다.");
}

export async function resetUserPassword(formData: FormData) {
  const userId = formString(formData, "userId");
  const password = formString(formData, "password");

  if (!userId) {
    await fail("처리할 사용자를 찾을 수 없습니다.");
  }

  if (password.length < 8) {
    await fail("임시 비밀번호는 8자 이상이어야 합니다.");
  }

  try {
    const currentUser = await requireRole(["ADMIN"]);

    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true
      }
    });

    if (!user) return fail("사용자를 찾을 수 없습니다.");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(password),
          mustChangePassword: true,
          sessionVersion: { increment: 1 }
        }
      });
      await tx.auditLog.create({ data: { action: "USER_PASSWORD_RESET", entityType: "USER", entityId: user.id, description: "관리자 임시 비밀번호 재설정", actorId: currentUser.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("사용자 관리 권한이 없습니다.");
    }

    throw error;
  }

  revalidatePath("/users");
  await redirectWithFlash("/users", "success", "임시 비밀번호가 설정되었습니다.");
}
