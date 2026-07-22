"use server";

/** 입고 LOT 생성과 입고 원장 기록을 같은 트랜잭션으로 수행하는 서버 액션이다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { isActiveWarehouse } from "@/lib/warehouse-data";

function formDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function fail(message: string): Promise<never> {
  return redirectWithFlash("/receiving", "error", message);
}

export async function createReceivingLot(formData: FormData) {
  const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
  const allergenId = formString(formData, "allergenId");
  const lotNo = formString(formData, "lotNo");
  const quantityRaw = formString(formData, "quantity");
  const receivedDateRaw = formString(formData, "receivedDate");
  const expirationDateRaw = formString(formData, "expirationDate");
  const warehouseRaw = formString(formData, "warehouse") || "FINISHED_GOODS";
  const memo = formString(formData, "memo");
  const quantity = Number.parseInt(quantityRaw, 10);

  if (!allergenId) {
    await fail("시약을 선택하세요.");
  }

  if (!lotNo) {
    await fail("제조번호를 입력하세요.");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    await fail("입고 수량은 1개 이상이어야 합니다.");
  }

  if (!receivedDateRaw || !expirationDateRaw) {
    await fail("입고일과 유통기한을 입력하세요.");
  }

  if (!(await isActiveWarehouse(warehouseRaw))) {
    return fail("입고 창고를 다시 선택하세요.");
  }

  const receivedDate = formDate(receivedDateRaw);
  const expirationDate = formDate(expirationDateRaw);

  if (Number.isNaN(receivedDate.getTime()) || Number.isNaN(expirationDate.getTime())) {
    await fail("날짜 형식이 올바르지 않습니다.");
  }

  if (expirationDate <= receivedDate) {
    await fail("유통기한은 입고일보다 이후여야 합니다.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const allergen = await tx.allergen.findUnique({
        where: {
          id: allergenId
        }
      });

      if (!allergen) {
        throw new Error("ALLERGEN_NOT_FOUND");
      }

      const existingLot = await tx.reagentLot.findUnique({
        where: {
          allergenId_lotNo_expirationDate: {
            allergenId,
            lotNo,
            expirationDate
          }
        }
      });

      if (existingLot) {
        throw new Error("DUPLICATE_LOT");
      }

      const lot = await tx.reagentLot.create({
        data: {
          allergenId,
          lotNo,
          receivedDate,
          expirationDate,
          initialQuantity: quantity,
          memo: memo || null,
          isActive: true
        }
      });

      await tx.warehouseStock.create({
        data: {
          reagentLotId: lot.id,
          warehouse: warehouseRaw,
          quantity
        }
      });

      await tx.stockMovement.create({
        data: {
          reagentLotId: lot.id,
          type: "IN",
          quantity,
          warehouse: warehouseRaw,
          destinationWarehouse: null,
          reason: memo || "입고 등록",
          refType: "RECEIVING",
          refId: lot.id,
          createdBy: user.id
        }
      });
    });
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      await fail("입고 등록 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "DUPLICATE_LOT") {
      await fail("동일한 시약, 제조번호, 유통기한의 입고분이 이미 있습니다.");
    }

    if (error instanceof Error && error.message === "ALLERGEN_NOT_FOUND") {
      await fail("선택한 시약을 찾을 수 없습니다.");
    }

    await fail("입고 저장 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/receiving");
  revalidatePath("/shipments");
  revalidatePath("/replacements");
  redirect("/lots");
}
