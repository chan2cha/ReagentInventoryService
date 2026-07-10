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
  redirect(`/shipments?error=${encodeURIComponent(message)}`);
}

export async function shipOrder(formData: FormData) {
  const orderId = formString(formData, "orderId");

  if (!orderId) {
    fail("출고 처리할 주문을 찾을 수 없습니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId
        },
        include: {
          items: {
            include: {
              allergen: true
            }
          }
        }
      });

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (order.status === "SHIPPED") {
        throw new Error("ORDER_ALREADY_SHIPPED");
      }

      if (order.status === "CANCELLED") {
        throw new Error("ORDER_CANCELLED");
      }

      const allocations: Array<{
        allergenId: string;
        lotId: string;
        quantity: number;
      }> = [];

      for (const item of order.items) {
        let remaining = item.quantity;
        const candidateLots = await tx.reagentLot.findMany({
          where: {
            allergenId: item.allergenId,
            currentQuantity: {
              gt: 0
            },
            isActive: true
          },
          orderBy: [
            { expirationDate: "asc" },
            { lotNo: "asc" }
          ]
        });

        for (const lot of candidateLots) {
          if (remaining <= 0) {
            break;
          }

          const quantity = Math.min(lot.currentQuantity, remaining);
          remaining -= quantity;

          allocations.push({
            allergenId: item.allergenId,
            lotId: lot.id,
            quantity
          });
        }

        if (remaining > 0) {
          throw new Error(`INSUFFICIENT_STOCK:${item.allergen.code}`);
        }
      }

      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          status: "SHIPPED",
          shippedBy: user.id,
      memo: "유통기한 빠른 순 자동 출고"
        }
      });

      for (const allocation of allocations) {
        await tx.reagentLot.update({
          where: {
            id: allocation.lotId
          },
          data: {
            currentQuantity: {
              decrement: allocation.quantity
            }
          }
        });

        await tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            reagentLotId: allocation.lotId,
            allergenId: allocation.allergenId,
            quantity: allocation.quantity
          }
        });

        await tx.stockMovement.create({
          data: {
            reagentLotId: allocation.lotId,
            type: "OUT",
            quantity: allocation.quantity,
            reason: order.orderNo,
            refType: "SHIPMENT",
            refId: shipment.id,
            createdBy: user.id
          }
        });
      }

      await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "SHIPPED"
        }
      });
      await tx.auditLog.create({ data: { action: "SHIPMENT_CREATE", entityType: "SHIPMENT", entityId: shipment.id, description: `${order.orderNo} 출고 처리`, actorId: user.id } });
    });
  } catch (error) {
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

    fail("출고 처리 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect("/shipments?success=출고 처리가 완료되었습니다.");
}

export async function cancelShipment(formData: FormData) {
  const shipmentId = formString(formData, "shipmentId");
  const reason = formString(formData, "reason");

  if (!shipmentId) {
    fail("취소할 출고 건을 찾을 수 없습니다.");
  }
  if (!reason) fail("출고 취소 사유를 입력하세요.");

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);

    await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: {
          id: shipmentId
        },
        include: {
          items: true,
          order: true
        }
      });

      if (!shipment) {
        throw new Error("SHIPMENT_NOT_FOUND");
      }

      if (shipment.status === "CANCELLED") {
        throw new Error("SHIPMENT_ALREADY_CANCELLED");
      }

      for (const item of shipment.items) {
        await tx.reagentLot.update({
          where: {
            id: item.reagentLotId
          },
          data: {
            currentQuantity: {
              increment: item.quantity
            }
          }
        });

        await tx.stockMovement.create({
          data: {
            reagentLotId: item.reagentLotId,
            type: "REVERSE",
            quantity: item.quantity,
            reason: `${shipment.order.orderNo} 출고 취소`,
            refType: "SHIPMENT_CANCEL",
            refId: shipment.id,
            createdBy: user.id
          }
        });
      }

      await tx.shipment.update({
        where: {
          id: shipment.id
        },
        data: {
          status: "CANCELLED",
          memo: shipment.memo ? `${shipment.memo} / 출고 취소: ${reason}` : `출고 취소: ${reason}`
        }
      });

      await tx.order.update({
        where: {
          id: shipment.orderId
        },
        data: {
          status: "READY_TO_SHIP"
        }
      });
      await tx.auditLog.create({ data: { action: "SHIPMENT_CANCEL", entityType: "SHIPMENT", entityId: shipment.id, description: `${shipment.order.orderNo} 출고 취소: ${reason}`, actorId: user.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("출고 취소 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      fail("출고 건을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "SHIPMENT_ALREADY_CANCELLED") {
      fail("이미 취소된 출고 건입니다.");
    }

    fail("출고 취소 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect("/shipments?success=출고가 취소되고 재고가 복구되었습니다.");
}
