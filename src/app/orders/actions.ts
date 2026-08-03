"use server";

/** 주문 취소 요청의 권한·입력 검증과 화면 갱신을 담당한다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString, formStrings } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeOrderItems } from "@/domain/order-items";
import { parseOrderImageUploads, type OrderImageUpload } from "@/domain/order-image";
import { cancelPendingOrder, updatePendingOrder, updateShippedOrderMetadata } from "@/services/order-service";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/orders", "error", message);
}

async function orderImageMutation(formData: FormData): Promise<OrderImageUpload | null | undefined> {
  const removeImage = formString(formData, "removeImage") === "1";
  const image = await parseOrderImageUploads(formData.getAll("image"));
  if (removeImage && image) throw new Error("ORDER_IMAGE_ACTION_CONFLICT");
  return image ?? (removeImage ? null : undefined);
}

async function failForOrderImage(error: Error) {
  if (error.message === "ORDER_IMAGE_SIZE_INVALID") {
    await fail("주문 이미지는 3MB 이하의 파일만 첨부할 수 있습니다.");
  }
  if (error.message === "ORDER_IMAGE_NAME_INVALID") {
    await fail("주문 이미지 파일명이 올바르지 않거나 너무 깁니다.");
  }
  if (error.message === "ORDER_IMAGE_ACTION_CONFLICT") {
    await fail("이미지 교체와 삭제를 동시에 요청할 수 없습니다.");
  }
  if (error.message.startsWith("ORDER_IMAGE_")) {
    await fail("실제 JPG, PNG 또는 WebP 이미지 파일만 첨부할 수 있습니다.");
  }
}

export async function updateOrder(formData: FormData) {
  const orderId = formString(formData, "orderId");
  const clientId = formString(formData, "clientId");
  const memo = formString(formData, "memo");

  if (!orderId) await fail("수정할 주문을 찾을 수 없습니다.");
  if (!clientId) await fail("거래처를 선택하세요.");

  let items: ReturnType<typeof normalizeOrderItems> = [];
  try {
    const allergenIds = formStrings(formData, "allergenId");
    const quantities = formStrings(formData, "quantity");
    items = normalizeOrderItems(allergenIds.map((allergenId, index) => ({
      allergenId,
      quantity: quantities[index] ?? ""
    })));
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_ITEM_REQUIRED") {
      await fail("주문 품목을 1개 이상 입력하세요.");
    }
    if (error instanceof Error && error.message === "ORDER_ITEM_ALLERGEN_REQUIRED") {
      await fail("모든 주문 품목의 시약을 선택하세요.");
    }
    if (error instanceof Error && error.message === "ORDER_ITEM_QUANTITY_INVALID") {
      await fail("모든 주문 수량은 1개 이상의 정수여야 합니다.");
    }
    await fail("주문 품목 입력값이 올바르지 않습니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    const image = await orderImageMutation(formData);
    await updatePendingOrder(prisma, orderId, user.id, {
      clientId,
      memo: memo || null,
      items,
      ...(image !== undefined ? { image } : {})
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error) await failForOrderImage(error);
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("주문 수정 권한이 없습니다.");
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") await fail("주문을 찾을 수 없습니다.");
    if (error instanceof Error && error.message === "ORDER_ALREADY_CANCELLED") await fail("삭제된 주문은 수정할 수 없습니다.");
    if (error instanceof Error && error.message === "ORDER_ALREADY_SHIPPED") await fail("출고된 주문은 수정할 수 없습니다.");
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") await fail("선택한 거래처를 찾을 수 없습니다.");
    if (error instanceof Error && error.message === "ALLERGEN_NOT_FOUND") await fail("선택한 시약을 찾을 수 없습니다.");
    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") await fail("다른 주문 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    await fail("주문 수정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  await redirectWithFlash("/orders", "success", "주문 정보가 수정되었습니다.");
}

export async function updateOrderMetadata(formData: FormData) {
  const orderId = formString(formData, "orderId");
  const memo = formString(formData, "memo");
  if (!orderId) await fail("수정할 주문을 찾을 수 없습니다.");

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    const image = await orderImageMutation(formData);
    await updateShippedOrderMetadata(prisma, orderId, user.id, {
      memo: memo || null,
      ...(image !== undefined ? { image } : {})
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error) await failForOrderImage(error);
    if (error instanceof Error && error.message === "FORBIDDEN") await fail("주문 수정 권한이 없습니다.");
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") await fail("주문을 찾을 수 없습니다.");
    if (error instanceof Error && error.message === "ORDER_ALREADY_CANCELLED") await fail("삭제된 주문은 수정할 수 없습니다.");
    if (error instanceof Error && error.message === "ORDER_NOT_SHIPPED") await fail("출고 완료 주문만 제한 수정할 수 있습니다.");
    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") await fail("다른 주문 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    await fail("주문 수정 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  await redirectWithFlash("/orders", "success", "출고 완료 주문의 메모·이미지가 수정되었습니다.");
}

export async function cancelOrder(formData: FormData) {
  const orderId = formString(formData, "orderId");
  const reason = formString(formData, "reason");

  if (!orderId) {
    await fail("취소할 주문을 찾을 수 없습니다.");
  }
  if (!reason) await fail("주문 취소 사유를 입력하세요.");

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    await cancelPendingOrder(prisma, orderId, user.id, reason);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("주문 취소 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      await fail("주문을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_CANCELLED") {
      await fail("이미 취소된 주문입니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_SHIPPED") {
      await fail("출고 완료된 주문은 취소할 수 없습니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 주문 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    await fail("주문 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  await redirectWithFlash("/orders", "success", "주문이 취소되었습니다.");
}
