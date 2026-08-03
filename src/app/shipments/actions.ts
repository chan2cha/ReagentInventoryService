"use server";

/** 출고와 출고 취소는 서비스 계층에서 재고 원장까지 함께 처리하도록 위임한다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processShipment, reverseShipment, updateShipmentMemo, type ShipmentAllocationInput } from "@/services/shipment-service";
import { parseOrderImageUploads } from "@/domain/order-image";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/shipments", "error", message);
}

export async function shipOrder(formData: FormData) {
  return confirmShipment(formData);
}

export async function updateShipment(formData: FormData) {
  const shipmentId = formString(formData, "shipmentId");
  const memo = formString(formData, "memo");

  if (!shipmentId) await fail("수정할 출고 건을 찾을 수 없습니다.");
  if (memo.length > 500) await fail("출고 메모는 500자 이하로 입력하세요.");

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    const removeImage = formString(formData, "removeImage") === "1";
    const uploadedImage = await parseOrderImageUploads(formData.getAll("image"));
    if (removeImage && uploadedImage) throw new Error("ORDER_IMAGE_ACTION_CONFLICT");
    const image = uploadedImage ?? (removeImage ? null : undefined);
    await updateShipmentMemo(prisma, shipmentId, user.id, memo || null, image);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "ORDER_IMAGE_SIZE_INVALID") await fail("주문 이미지는 3MB 이하의 파일만 첨부할 수 있습니다.");
    if (error instanceof Error && error.message === "ORDER_IMAGE_NAME_INVALID") await fail("주문 이미지 파일명이 올바르지 않거나 너무 깁니다.");
    if (error instanceof Error && error.message === "ORDER_IMAGE_ACTION_CONFLICT") await fail("이미지 교체와 삭제를 동시에 요청할 수 없습니다.");
    if (error instanceof Error && error.message.startsWith("ORDER_IMAGE_")) await fail("실제 JPG, PNG 또는 WebP 이미지 파일만 첨부할 수 있습니다.");
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("출고 수정 권한이 없습니다.");
    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") await fail("출고 건을 찾을 수 없습니다.");
    if (error instanceof Error && error.message === "SHIPMENT_ALREADY_CANCELLED") await fail("삭제된 출고 건은 수정할 수 없습니다.");
    if (error instanceof Error && error.message === "SHIPMENT_NOT_EDITABLE") await fail("수정할 수 없는 출고 건입니다.");
    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") await fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    await fail("출고 수정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/movements");
  revalidatePath("/shipments");
  await redirectWithFlash("/shipments", "success", "출고 정보가 수정되었습니다.");
}

export async function confirmShipment(formData: FormData) {
  const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
  const orderId = formString(formData, "orderId");
  const shipmentMemo = formString(formData, "shipmentMemo");
  const lotIds = formData.getAll("lotId");
  const warehouses = formData.getAll("warehouse");
  const quantities = formData.getAll("quantity");

  if (!orderId) {
    await fail("출고 처리할 주문을 찾을 수 없습니다.");
  }

  if (
    lotIds.length !== quantities.length ||
    lotIds.length !== warehouses.length ||
    lotIds.length === 0
  ) {
    await fail("출고 LOT 배정 정보를 확인하세요.");
  }

  if (shipmentMemo.length > 500) {
    await fail("출고 메모는 500자 이하로 입력하세요.");
  }

  const allocations: ShipmentAllocationInput[] = [];
  for (let index = 0; index < lotIds.length; index += 1) {
    const lotValue = lotIds[index];
    const warehouseValue = warehouses[index];
    const quantityValue = quantities[index];
    const lotId = typeof lotValue === "string" ? lotValue : "";
    const warehouse = typeof warehouseValue === "string" ? warehouseValue : "";
    const quantityText = typeof quantityValue === "string" ? quantityValue : "";
    const quantity = Number(quantityText);
    if (!lotId || !warehouse || !Number.isInteger(quantity) || quantity < 0) {
      await fail("출고 수량은 0 이상의 정수로 입력하세요.");
    }
    if (quantity > 0) allocations.push({ lotId, warehouse, quantity });
  }

  let shortageOrderNo: string | null = null;
  try {
    const shipment = await processShipment(
      prisma,
      orderId,
      user.id,
      undefined,
      allocations,
      shipmentMemo || undefined
    );
    shortageOrderNo = shipment.shortageOrder?.orderNo ?? null;
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

    if (error instanceof Error && error.message === "NO_ALLOCATIONS") {
      await fail("출고 가능한 재고가 없습니다. 재고를 입고한 후 다시 시도해 주세요.");
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

    if (error instanceof Error && error.message === "SHIPMENT_MEMO_TOO_LONG") {
      await fail("출고 메모는 500자 이하로 입력하세요.");
    }

    if (error instanceof Error && error.message === "PARTIAL_SHIPMENT_MEMO_REQUIRED") {
      await fail("부분 출고 시에는 출고 메모를 반드시 입력하세요.");
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
  await redirectWithFlash(
    "/shipments",
    "success",
    shortageOrderNo
      ? `부분 출고가 완료되었고 부족분 재주문 ${shortageOrderNo}이 생성되었습니다.`
      : "정상 출고가 완료되었습니다."
  );
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

    if (error instanceof Error && error.message === "SHORTAGE_REORDER_ALREADY_SHIPPED") {
      await fail("부족분 재주문이 이미 출고되어 원출고를 취소할 수 없습니다. 부족분 출고를 먼저 취소하세요.");
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
