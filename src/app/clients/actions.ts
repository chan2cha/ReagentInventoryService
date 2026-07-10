"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/clients?error=${encodeURIComponent(message)}` as never);
}

async function ensureUniqueName(name: string, excludeId?: string) {
  const duplicate = await prisma.client.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });
  if (duplicate) fail("이미 등록된 거래처명입니다.");
}

function clientData(formData: FormData) {
  const name = formString(formData, "name");
  if (!name) fail("거래처명을 입력하세요.");

  return {
    name,
    managerName: formString(formData, "managerName") || null,
    phone: formString(formData, "phone") || null,
    address: formString(formData, "address") || null,
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
    const data = clientData(formData);
    await ensureUniqueName(data.name);
    await prisma.client.create({ data: { ...data, isActive: true } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  redirect("/clients?success=거래처가 등록되었습니다." as never);
}

export async function updateClient(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const clientId = formString(formData, "clientId");
    if (!clientId) fail("수정할 거래처를 찾을 수 없습니다.");
    const data = clientData(formData);
    await ensureUniqueName(data.name, clientId);
    await prisma.client.update({ where: { id: clientId }, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  redirect("/clients?success=거래처 정보가 수정되었습니다." as never);
}

export async function toggleClientActive(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const clientId = formString(formData, "clientId");
    if (!clientId) fail("처리할 거래처를 찾을 수 없습니다.");
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { isActive: true } });
    if (!client) fail("거래처를 찾을 수 없습니다.");
    await prisma.client.update({ where: { id: clientId }, data: { isActive: !client.isActive } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("거래처 관리 권한이 없습니다.");
    throw error;
  }

  revalidateClientPaths();
  redirect("/clients?success=거래처 상태가 변경되었습니다." as never);
}
