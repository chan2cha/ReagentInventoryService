"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { buildActionMessageUrl } from "@/lib/action-message-url";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder } from "@/services/order-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(buildActionMessageUrl("/orders", "error", message) as never);
}

export async function cancelOrder(formData: FormData) {
  const orderId = formString(formData, "orderId");
  const reason = formString(formData, "reason");

  if (!orderId) {
    fail("취소할 주문을 찾을 수 없습니다.");
  }
  if (!reason) fail("주문 취소 사유를 입력하세요.");

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    await cancelPendingOrder(prisma, orderId, user.id, reason);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("주문 취소 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      fail("주문을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_CANCELLED") {
      fail("이미 취소된 주문입니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_SHIPPED") {
      fail("출고 완료된 주문은 취소할 수 없습니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      fail("다른 주문 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    fail("주문 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect(buildActionMessageUrl("/orders", "success", "주문이 취소되었습니다.") as never);
}
