"use server";

import { revalidatePath } from "next/cache";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/warehouses", "error", message);
}

function revalidateWarehousePaths() {
  ["/warehouses", "/lots", "/receiving", "/movements", "/exports"].forEach((path) => revalidatePath(path));
}

export async function createWarehouse(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const code = formString(formData, "code").toUpperCase();
    const name = formString(formData, "name");
    if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(code)) await fail("창고 코드는 영문 대문자, 숫자, 밑줄로 2~30자 입력하세요.");
    if (!name || name.length > 50) await fail("창고명은 1~50자로 입력하세요.");

    const duplicate = await prisma.warehouse.findFirst({
      where: { OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] },
      select: { id: true }
    });
    if (duplicate) await fail("동일한 창고 코드 또는 창고명이 이미 있습니다.");
    await prisma.warehouse.create({ data: { code, name } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("창고 관리 권한이 없습니다.");
    throw error;
  }
  revalidateWarehousePaths();
  await redirectWithFlash("/warehouses", "success", "창고를 추가했습니다.");
}

export async function toggleWarehouseActive(formData: FormData) {
  try {
    await requireRole(["ADMIN"]);
    const warehouseId = formString(formData, "warehouseId");
    if (!warehouseId) await fail("변경할 창고를 찾을 수 없습니다.");
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) return fail("변경할 창고를 찾을 수 없습니다.");
    if (warehouse.code === "FINISHED_GOODS") await fail("완제품 창고는 출고 기준 창고이므로 비활성화할 수 없습니다.");

    const stock = await prisma.warehouseStock.aggregate({
      where: { warehouse: warehouse.code, quantity: { gt: 0 } },
      _sum: { quantity: true }
    });
    if (warehouse.isActive && (stock._sum.quantity ?? 0) > 0) await fail("재고가 남아 있는 창고는 비활성화할 수 없습니다. 재고를 모두 이동한 뒤 다시 시도하세요.");
    await prisma.warehouse.update({ where: { id: warehouse.id }, data: { isActive: !warehouse.isActive } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("창고 관리 권한이 없습니다.");
    throw error;
  }
  revalidateWarehousePaths();
  await redirectWithFlash("/warehouses", "success", "창고 상태를 변경했습니다.");
}
