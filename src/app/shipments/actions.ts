"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { buildActionMessageUrl } from "@/lib/action-message-url";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processShipment, reverseShipment } from "@/services/shipment-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(buildActionMessageUrl("/shipments", "error", message) as never);
}

export async function shipOrder(formData: FormData) {
  const orderId = formString(formData, "orderId");

  if (!orderId) {
    fail("출고 처리할 주문을 찾을 수 없습니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await processShipment(prisma, orderId, user.id);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("출고 처리 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      fail("주문을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_SHIPPED") {
      fail("이미 출고 완료된 주문입니다.");
    }

    if (error instanceof Error && error.message === "ORDER_CANCELLED") {
      fail("취소된 주문은 출고할 수 없습니다.");
    }

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const code = error.message.split(":")[1];
      fail(`${code} 시약의 출고 가능 재고가 부족합니다.`);
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    fail("출고 처리 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect(buildActionMessageUrl("/shipments", "success", "출고 처리가 완료되었습니다.") as never);
}

export async function cancelShipment(formData: FormData) {
  const shipmentId = formString(formData, "shipmentId");
  const reason = formString(formData, "reason");

  if (!shipmentId) {
    fail("취소할 출고 건을 찾을 수 없습니다.");
  }

  if (!reason) {
    fail("출고 취소 사유를 입력하세요.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await reverseShipment(prisma, shipmentId, user.id, reason);
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("출고 취소 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      fail("출고 건을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_ALREADY_CANCELLED") {
      fail("이미 취소된 출고 건입니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      fail("다른 재고 처리와 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    fail("출고 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect(buildActionMessageUrl("/shipments", "success", "출고가 취소되고 재고가 복구되었습니다.") as never);
}
