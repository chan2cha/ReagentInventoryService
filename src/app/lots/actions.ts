"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextStockQuantity, signedAdjustmentQuantity, type StockAdjustmentOperation } from "@/domain/stock-adjustment";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/lots?error=${encodeURIComponent(message)}` as never);
}

export async function adjustLotStock(formData: FormData) {
  const lotId = formString(formData, "lotId");
  const quantityRaw = formString(formData, "quantity");
  const reason = formString(formData, "reason");
  const operationRaw = formString(formData, "operation");

  if (!["ADD", "REMOVE", "DISPOSE"].includes(operationRaw)) {
    fail("처리 유형을 선택하세요.");
  }

  const operation = operationRaw as StockAdjustmentOperation;
  const type = operation === "DISPOSE" ? "DISPOSE" : "ADJUST";

  if (!lotId) {
    fail("조정할 입고분을 찾을 수 없습니다.");
  }

  if (!reason) {
    fail("조정 사유를 입력하세요.");
  }

  let quantity: number;

  try {
    quantity = signedAdjustmentQuantity(operation, quantityRaw);
  } catch {
    fail("변경 수량은 1 이상의 정수로 입력하세요.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);

    await prisma.$transaction(async (tx) => {
      const lot = await tx.reagentLot.findUnique({
        where: {
          id: lotId
        },
        select: {
          id: true,
          currentQuantity: true
        }
      });

      if (!lot) {
        throw new Error("LOT_NOT_FOUND");
      }

      const nextQuantity = nextStockQuantity(lot.currentQuantity, quantity);

      await tx.reagentLot.update({
        where: {
          id: lot.id
        },
        data: {
          currentQuantity: nextQuantity
        }
      });

      await tx.stockMovement.create({
        data: {
          reagentLotId: lot.id,
          type,
          quantity,
          reason,
          refType: "STOCK_ADJUSTMENT",
          refId: lot.id,
          createdBy: user.id
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("재고 조정 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "LOT_NOT_FOUND") {
      fail("조정할 입고분을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ADJUSTMENT_STOCK_NEGATIVE") {
      fail("조정 후 현재 수량은 음수가 될 수 없습니다.");
    }

    fail("재고 조정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  redirect("/lots?success=재고 수량과 이력이 반영되었습니다." as never);
}
