"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/clients", "error", message);
}

async function ensureUniqueName(name: string, excludeId?: string) {
  const duplicate = await prisma.client.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });
  if (duplicate) await fail("이미 등록된 거래처명입니다.");
}

async function clientData(formData: FormData) {
  const name = formString(formData, "name");
  if (!name) await fail("거래처명을 입력하세요.");

  return {
    name,
    region: formString(formData, "region") || null,
    managerName: formString(formData, "managerName") || null,
    deliveryDepartment: formString(formData, "deliveryDepartment") || null,
    memo: formString(formData, "memo") || null
  };
}

function revalidateClientPaths() {
  revalidatePath("/clients");
  revalidatePath("/orders/new");
}

export async function createClient(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const data = await clientData(formData);
    await ensureUniqueName(data.name);
    await prisma.client.create({ data: { ...data, isActive: true } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  await redirectWithFlash("/clients", "success", "거래처가 등록되었습니다.");
}

export async function updateClient(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const clientId = formString(formData, "clientId");
    if (!clientId) await fail("수정할 거래처를 찾을 수 없습니다.");
    const data = await clientData(formData);
    await ensureUniqueName(data.name, clientId);
    await prisma.client.update({ where: { id: clientId }, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  await redirectWithFlash("/clients", "success", "거래처 정보가 수정되었습니다.");
}

export async function toggleClientActive(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const clientId = formString(formData, "clientId");
    if (!clientId) await fail("처리할 거래처를 찾을 수 없습니다.");
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { isActive: true } });
    if (!client) return fail("거래처를 찾을 수 없습니다.");
    await prisma.client.update({ where: { id: clientId }, data: { isActive: !client.isActive } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  await redirectWithFlash("/clients", "success", "거래처 상태가 변경되었습니다.");
}
