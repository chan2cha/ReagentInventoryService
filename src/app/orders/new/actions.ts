"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeOrderItems } from "@/domain/order-items";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { koreaDatePrefix } from "@/lib/date";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/orders/new?error=${encodeURIComponent(message)}` as never);
}

async function nextOrderNo(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const datePrefix = koreaDatePrefix();
  const prefix = `ORD-${datePrefix}-`;

  const latest = await tx.order.findFirst({
    where: {
      orderNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      orderNo: "desc"
    }
  });

  const nextSeq = latest ? Number.parseInt(latest.orderNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

export async function createOrder(formData: FormData) {
  const clientId = formString(formData, "clientId");
  const memo = formString(formData, "memo");
  const allergenIds = formData.getAll("allergenId").map((value) => typeof value === "string" ? value : "");
  const quantities = formData.getAll("quantity").map((value) => typeof value === "string" ? value : "");

  if (!clientId) {
    fail("거래처를 선택하세요.");
  }

  let items;

  try {
    items = normalizeOrderItems(
      allergenIds.map((allergenId, index) => ({
        allergenId,
        quantity: quantities[index] ?? ""
      }))
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_ITEM_REQUIRED") {
      fail("주문 품목을 1개 이상 입력하세요.");
    }

    if (error instanceof Error && error.message === "ORDER_ITEM_ALLERGEN_REQUIRED") {
      fail("모든 주문 품목의 시약을 선택하세요.");
    }

    if (error instanceof Error && error.message === "ORDER_ITEM_QUANTITY_INVALID") {
      fail("모든 주문 수량은 1개 이상이어야 합니다.");
    }

    fail("주문 품목 입력값이 올바르지 않습니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);

    await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: {
          id: clientId
        }
      });

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const allergenCount = await tx.allergen.count({
        where: {
          id: {
            in: items.map((item) => item.allergenId)
          },
          isActive: true
        }
      });

      if (allergenCount !== items.length) {
        throw new Error("ALLERGEN_NOT_FOUND");
      }

      const orderNo = await nextOrderNo(tx);
      const order = await tx.order.create({
        data: {
          orderNo,
          clientId,
          status: "RECEIVED",
          memo: memo || null,
          createdBy: user.id
        }
      });

      await tx.orderItem.createMany({
        data: items.map((item) => ({
          orderId: order.id,
          allergenId: item.allergenId,
          quantity: item.quantity
        }))
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      fail("주문 등록 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      fail("선택한 거래처를 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ALLERGEN_NOT_FOUND") {
      fail("선택한 시약을 찾을 수 없습니다.");
    }

    fail("주문 저장 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect("/orders" as never);
}
