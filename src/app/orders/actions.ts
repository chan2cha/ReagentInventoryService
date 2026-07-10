"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/orders?error=${encodeURIComponent(message)}`);
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

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId
        },
        include: {
          shipments: true
        }
      });

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (order.status === "CANCELLED") {
        throw new Error("ORDER_ALREADY_CANCELLED");
      }

      if (order.status === "SHIPPED" || order.shipments.some((shipment) => shipment.status === "SHIPPED")) {
        throw new Error("ORDER_ALREADY_SHIPPED");
      }

      await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "CANCELLED"
        }
      });
      await tx.auditLog.create({ data: { action: "ORDER_CANCEL", entityType: "ORDER", entityId: order.id, description: `${order.orderNo} 취소: ${reason}`, actorId: user.id } });
    });
  } catch (error) {
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

    fail("주문 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect("/orders?success=주문이 취소되었습니다.");
}
