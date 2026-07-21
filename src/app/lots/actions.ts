"use server";

/** LOT 재고 조정 입력을 권한 검증 후 재고 서비스로 전달하는 서버 액션이다. */

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { signedAdjustmentQuantity, type StockAdjustmentOperation } from "@/domain/stock-adjustment";
import { isWarehouseKind } from "@/domain/warehouse";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustLotStockValue } from "@/services/stock-service";
import { transferWarehouseStock } from "@/services/warehouse-transfer-service";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/lots", "error", message);
}

export async function adjustLotStock(formData: FormData) {
  const lotId = formString(formData, "lotId");
  const quantityRaw = formString(formData, "quantity");
  const reason = formString(formData, "reason");
  const operationRaw = formString(formData, "operation");
  const warehouseRaw = formString(formData, "warehouse") || "FINISHED_GOODS";

  if (!["ADD", "REMOVE", "DISPOSE"].includes(operationRaw)) {
    await fail("처리 유형을 선택하세요.");
  }

  const operation = operationRaw as StockAdjustmentOperation;
  const type = operation === "DISPOSE" ? "DISPOSE" : "ADJUST";

  if (!lotId) {
    await fail("조정할 입고분을 찾을 수 없습니다.");
  }

  if (!isWarehouseKind(warehouseRaw)) {
    return fail("조정할 창고를 다시 선택하세요.");
  }

  if (!reason) {
    await fail("조정 사유를 입력하세요.");
  }

  let quantity: number;

  try {
    quantity = signedAdjustmentQuantity(operation, quantityRaw);
  } catch {
    return fail("변경 수량은 1 이상의 정수로 입력하세요.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await adjustLotStockValue(prisma, {
      lotId,
      quantity,
      type,
      reason,
      warehouse: warehouseRaw,
      actorId: user.id
    });
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("재고 조정 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "LOT_NOT_FOUND") {
      await fail("조정할 입고분을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "WAREHOUSE_STOCK_NOT_FOUND") {
      await fail("조정할 창고 재고를 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ADJUSTMENT_STOCK_NEGATIVE") {
      await fail("조정 후 현재 수량은 음수가 될 수 없습니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    await fail("재고 조정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/shipments");
  revalidatePath("/replacements");
  await redirectWithFlash("/lots", "success", "재고 수량과 이력이 반영되었습니다.");
}

export async function transferLotWarehouse(formData: FormData) {
  const lotId = formString(formData, "lotId");
  const sourceWarehouseRaw = formString(formData, "sourceWarehouse");
  const destinationWarehouseRaw = formString(formData, "destinationWarehouse");
  const quantityRaw = formString(formData, "quantity");
  const reason = formString(formData, "reason");

  if (!lotId) {
    await fail("이동할 입고분을 찾을 수 없습니다.");
  }

  if (!isWarehouseKind(sourceWarehouseRaw) || !isWarehouseKind(destinationWarehouseRaw)) {
    return fail("출발 창고와 도착 창고를 다시 선택하세요.");
  }

  if (sourceWarehouseRaw === destinationWarehouseRaw) {
    await fail("현재 창고와 다른 도착 창고를 선택하세요.");
  }

  const quantity = Number(quantityRaw);
  if (!/^\d+$/.test(quantityRaw) || !Number.isSafeInteger(quantity) || quantity < 1) {
    await fail("이동 수량은 1 이상의 정수로 입력하세요.");
  }

  if (!reason) {
    await fail("이동 사유를 입력하세요.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await transferWarehouseStock(prisma, {
      actorId: user.id,
      destinationWarehouse: destinationWarehouseRaw,
      lotId,
      quantity,
      reason,
      sourceWarehouse: sourceWarehouseRaw
    });
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("창고간 재고 이동 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "LOT_NOT_FOUND") {
      await fail("이동할 입고분을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "WAREHOUSE_TRANSFER_STOCK_INSUFFICIENT") {
      await fail("현재 창고 수량보다 많이 이동할 수 없습니다.");
    }

    if (error instanceof Error && error.message === "WAREHOUSE_TRANSFER_SAME_WAREHOUSE") {
      await fail("현재 창고와 다른 도착 창고를 선택하세요.");
    }

    if (error instanceof Error && error.message === "WAREHOUSE_TRANSFER_QUANTITY_INVALID") {
      await fail("이동 수량은 1 이상의 정수로 입력하세요.");
    }

    if (error instanceof Error && error.message === "WAREHOUSE_TRANSFER_REASON_REQUIRED") {
      await fail("이동 사유를 입력하세요.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    await fail("창고간 재고 이동 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/shipments");
  revalidatePath("/replacements");
  await redirectWithFlash("/lots", "success", "창고간 재고 이동과 이력이 반영되었습니다.");
}
