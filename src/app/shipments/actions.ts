"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processShipment, reverseShipment, type ShipmentAllocationInput } from "@/services/shipment-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/shipments", "error", message);
}

export async function shipOrder(formData: FormData) {
  return confirmShipment(formData);
}

export async function confirmShipment(formData: FormData) {
  const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
  const orderId = formString(formData, "orderId");
  const lotIds = formData.getAll("lotId");
  const quantities = formData.getAll("quantity");

  if (!orderId) {
    await fail("출고 처리할 주문을 찾을 수 없습니다.");
  }

  if (lotIds.length !== quantities.length || lotIds.length === 0) {
    await fail("출고 LOT 배정 정보를 확인하세요.");
  }

  const allocations: ShipmentAllocationInput[] = [];
  for (let index = 0; index < lotIds.length; index += 1) {
    const lotValue = lotIds[index];
    const quantityValue = quantities[index];
    const lotId = typeof lotValue === "string" ? lotValue : "";
    const quantityText = typeof quantityValue === "string" ? quantityValue : "";
    const quantity = Number(quantityText);
    if (!lotId || !Number.isInteger(quantity) || quantity < 0) {
      await fail("출고 수량은 0 이상의 정수로 입력하세요.");
    }
    if (quantity > 0) allocations.push({ lotId, quantity });
  }

  try {
    await processShipment(prisma, orderId, user.id, undefined, allocations);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("출고 처리 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      await fail("주문을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_SHIPPED") {
      await fail("이미 출고 완료된 주문입니다.");
    }

    if (error instanceof Error && error.message === "ORDER_CANCELLED") {
      await fail("취소된 주문은 출고할 수 없습니다.");
    }

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const code = error.message.split(":")[1];
      await fail(`${code} 시약의 출고 가능 재고가 부족합니다.`);
    }

    if (error instanceof Error && error.message.startsWith("ALLOCATION_QUANTITY_MISMATCH:")) {
      const code = error.message.split(":")[1];
      await fail(`${code} 시약의 LOT별 출고 수량 합계가 주문 수량과 다릅니다.`);
    }

    if (error instanceof Error && error.message === "INVALID_ALLOCATION") {
      await fail("선택한 LOT가 주문 품목과 일치하지 않습니다.");
    }

    if (error instanceof Error && error.message === "ALLOCATION_UNAVAILABLE") {
      await fail("선택한 LOT의 재고 또는 출고 가능 상태가 변경되었습니다. 배정안을 다시 확인하세요.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    await fail("출고 처리 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  await redirectWithFlash("/shipments", "success", "LOT별 배정으로 출고 처리가 완료되었습니다.");
}

export async function cancelShipment(formData: FormData) {
  const shipmentId = formString(formData, "shipmentId");
  const reason = formString(formData, "reason");

  if (!shipmentId) {
    await fail("취소할 출고 건을 찾을 수 없습니다.");
  }

  if (!reason) {
    await fail("출고 취소 사유를 입력하세요.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await reverseShipment(prisma, shipmentId, user.id, reason);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("출고 취소 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      await fail("출고 건을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_ALREADY_CANCELLED") {
      await fail("이미 취소된 출고 건입니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    await fail("출고 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  await redirectWithFlash("/shipments", "success", "출고가 취소되고 재고가 복구되었습니다.");
}
