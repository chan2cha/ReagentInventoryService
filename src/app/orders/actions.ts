"use server";

/** 주문 취소 요청의 권한·입력 검증과 화면 갱신을 담당한다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPendingOrder } from "@/services/order-service";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/orders", "error", message);
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
