"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { signedAdjustmentQuantity, type StockAdjustmentOperation } from "@/domain/stock-adjustment";
import { buildActionMessageUrl } from "@/lib/action-message-url";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustLotStockValue } from "@/services/stock-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(buildActionMessageUrl("/lots", "error", message) as never);
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
    await adjustLotStockValue(prisma, {
      lotId,
      quantity,
      type,
      reason,
      actorId: user.id
    });
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("재고 조정 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "LOT_NOT_FOUND") {
      fail("조정할 입고분을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ADJUSTMENT_STOCK_NEGATIVE") {
      fail("조정 후 현재 수량은 음수가 될 수 없습니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    fail("재고 조정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  redirect(buildActionMessageUrl("/lots", "success", "재고 수량과 이력이 반영되었습니다.") as never);
}
