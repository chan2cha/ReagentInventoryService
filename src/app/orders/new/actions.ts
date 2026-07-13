"use server";

/** 새 주문 폼의 반복 입력을 정리한 뒤 주문 생성 트랜잭션을 호출한다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { normalizeOrderItems } from "@/domain/order-items";
import { requireRole } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString, formStrings } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { createOrderValue } from "@/services/order-create-service";

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/orders/new", "error", message);
}

export async function createOrder(formData: FormData) {
  const clientId = formString(formData, "clientId");
  const memo = formString(formData, "memo");
  const allergenIds = formStrings(formData, "allergenId");
  const quantities = formStrings(formData, "quantity");

  if (!clientId) {
    await fail("거래처를 선택하세요.");
  }

  let items: ReturnType<typeof normalizeOrderItems>;

  try {
    items = normalizeOrderItems(
      allergenIds.map((allergenId, index) => ({
        allergenId,
        quantity: quantities[index] ?? ""
      }))
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_ITEM_REQUIRED") {
      return fail("주문 품목을 1개 이상 입력하세요.");
    }

    if (error instanceof Error && error.message === "ORDER_ITEM_ALLERGEN_REQUIRED") {
      return fail("모든 주문 품목의 시약을 선택하세요.");
    }

    if (error instanceof Error && error.message === "ORDER_ITEM_QUANTITY_INVALID") {
      return fail("모든 주문 수량은 1개 이상이어야 합니다.");
    }

    return fail("주문 품목 입력값이 올바르지 않습니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    await createOrderValue(prisma, {
      clientId,
      memo: memo || null,
      items,
      actorId: user.id
    });
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("주문 등록 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      await fail("선택한 거래처를 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "ALLERGEN_NOT_FOUND") {
      await fail("선택한 시약을 찾을 수 없습니다.");
    }

    if (error instanceof Error && error.message === "TRANSACTION_CONFLICT") {
      await fail("다른 주문 등록과 겹쳤습니다. 잠시 후 다시 시도하세요.");
    }

    if (error instanceof Error && error.message === "ORDER_DAILY_LIMIT_REACHED") {
      await fail("오늘 등록 가능한 주문번호 999건을 모두 사용했습니다. 관리자에게 문의하세요.");
    }

    await fail("주문 저장 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/shipments");
  redirect("/orders" as never);
}
