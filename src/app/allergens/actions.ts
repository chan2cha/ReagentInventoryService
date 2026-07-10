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
  redirect(`/allergens?error=${encodeURIComponent(message)}` as never);
}

function minStockValue(formData: FormData) {
  const raw = formString(formData, "minStock");
  const value = Number(raw);

  if (!raw || !Number.isInteger(value) || value < 0) {
    fail("안전 수량은 0 이상의 정수로 입력하세요.");
  }

  return value;
}

async function ensureUniqueCode(code: string, excludeId?: string) {
  const duplicate = await prisma.allergen.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });

  if (duplicate) {
    fail("이미 등록된 시약 코드입니다.");
  }
}

function revalidateAllergenPaths() {
  revalidatePath("/");
  revalidatePath("/allergens");
  revalidatePath("/lots");
  revalidatePath("/receiving");
  revalidatePath("/orders/new");
}

export async function createAllergen(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const code = formString(formData, "code").toUpperCase();
    const name = formString(formData, "name");
    const category = formString(formData, "category");
    const minStock = minStockValue(formData);

    if (!code || !/^[A-Z0-9._-]{2,30}$/.test(code)) {
      fail("시약 코드는 영문, 숫자, 점, 밑줄, 하이픈 조합 2~30자로 입력하세요.");
    }
    if (!name) fail("시약명을 입력하세요.");

    await ensureUniqueCode(code);
    await prisma.allergen.create({
      data: { code, name, category: category || null, minStock, isActive: true }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("시약 관리 권한이 없습니다.");
    throw error;
  }

  revalidateAllergenPaths();
  redirect("/allergens?success=시약이 등록되었습니다." as never);
}

export async function updateAllergen(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const allergenId = formString(formData, "allergenId");
    const code = formString(formData, "code").toUpperCase();
    const name = formString(formData, "name");
    const category = formString(formData, "category");
    const minStock = minStockValue(formData);

    if (!allergenId) fail("수정할 시약을 찾을 수 없습니다.");
    if (!code || !/^[A-Z0-9._-]{2,30}$/.test(code)) fail("올바른 시약 코드를 입력하세요.");
    if (!name) fail("시약명을 입력하세요.");

    await ensureUniqueCode(code, allergenId);
    await prisma.allergen.update({
      where: { id: allergenId },
      data: { code, name, category: category || null, minStock }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("시약 관리 권한이 없습니다.");
    throw error;
  }

  revalidateAllergenPaths();
  redirect("/allergens?success=시약 정보가 수정되었습니다." as never);
}

export async function toggleAllergenActive(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const allergenId = formString(formData, "allergenId");
    if (!allergenId) fail("처리할 시약을 찾을 수 없습니다.");

    const allergen = await prisma.allergen.findUnique({
      where: { id: allergenId },
      select: { isActive: true }
    });
    if (!allergen) fail("시약을 찾을 수 없습니다.");

    await prisma.allergen.update({
      where: { id: allergenId },
      data: { isActive: !allergen.isActive }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") fail("시약 관리 권한이 없습니다.");
    throw error;
  }

  revalidateAllergenPaths();
  redirect("/allergens?success=시약 상태가 변경되었습니다." as never);
}
