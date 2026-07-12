"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function fail(message: string): never {
  redirect(`/receiving?error=${encodeURIComponent(message)}`);
}

export async function createReceivingLot(formData: FormData) {
  const allergenId = formString(formData, "allergenId");
  const lotNo = formString(formData, "lotNo");
  const quantityRaw = formString(formData, "quantity");
  const receivedDateRaw = formString(formData, "receivedDate");
  const expirationDateRaw = formString(formData, "expirationDate");
  const memo = formString(formData, "memo");
  const quantity = Number.parseInt(quantityRaw, 10);

  if (!allergenId) {
    fail("시약을 선택하세요.");
  }

  if (!lotNo) {
    fail("제조번호를 입력하세요.");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    fail("입고 수량은 1개 이상이어야 합니다.");
  }

  if (!receivedDateRaw || !expirationDateRaw) {
    fail("입고일과 유통기한을 입력하세요.");
  }

  const receivedDate = formDate(receivedDateRaw);
  const expirationDate = formDate(expirationDateRaw);

  if (Number.isNaN(receivedDate.getTime()) || Number.isNaN(expirationDate.getTime())) {
    fail("날짜 형식이 올바르지 않습니다.");
  }

  if (expirationDate <= receivedDate) {
    fail("유통기한은 입고일보다 이후여야 합니다.");
  }

  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);

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
          currentQuantity: quantity,
          memo: memo || null,
          isActive: true
        }
      });

      await tx.stockMovement.create({
        data: {
          reagentLotId: lot.id,
          type: "IN",
          quantity,
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
      fail("입고 등록 권한이 없습니다.");
    }

    if (error instanceof Error && error.message === "DUPLICATE_LOT") {
      fail("동일한 시약, 제조번호, 유통기한의 입고분이 이미 있습니다.");
    }

    if (error instanceof Error && error.message === "ALLERGEN_NOT_FOUND") {
      fail("선택한 시약을 찾을 수 없습니다.");
    }

    fail("입고 저장 중 오류가 발생했습니다. 연결 상태를 확인하세요.");
  }

  revalidatePath("/lots");
  revalidatePath("/movements");
  revalidatePath("/receiving");
  redirect("/lots");
}
