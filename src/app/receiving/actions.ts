"use server";

/** 입고 LOT 생성과 입고 원장 기록을 같은 트랜잭션으로 수행하는 서버 액션이다. */

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { isActiveWarehouse } from "@/lib/warehouse-data";
import {
  parseReceivingWorkbook,
  RECEIVING_IMPORT_FILE_LIMIT,
  ReceivingImportError
} from "@/domain/receiving-import";

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

export async function importReceivingLots(formData: FormData) {
  const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
  const file = formData.get("file");

  if (typeof file === "string" || file === null || file.size === 0) {
    return fail("등록할 엑셀 파일을 선택하세요.");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    await fail(".xlsx 형식의 엑셀 파일만 등록할 수 있습니다.");
  }
  if (file.size > RECEIVING_IMPORT_FILE_LIMIT) {
    await fail("엑셀 파일은 3MB 이하만 등록할 수 있습니다.");
  }

  try {
    const rows = await parseReceivingWorkbook(await file.arrayBuffer());
    const allergenNames = [...new Set(rows.map((row) => row.allergenName))];
    const warehouseNames = [...new Set(rows.map((row) => row.warehouseName))];

    await prisma.$transaction(async (tx) => {
      const [allergens, warehouses] = await Promise.all([
        tx.allergen.findMany({
          where: { name: { in: allergenNames }, isActive: true },
          select: { id: true, name: true }
        }),
        tx.warehouse.findMany({
          where: { name: { in: warehouseNames }, isActive: true },
          select: { code: true, name: true }
        })
      ]);
      const allergenByName = new Map<string, string>();
      const duplicateAllergenNames = new Set<string>();
      for (const allergen of allergens) {
        if (allergenByName.has(allergen.name)) duplicateAllergenNames.add(allergen.name);
        allergenByName.set(allergen.name, allergen.id);
      }
      const warehouseCodeByName = new Map(warehouses.map((warehouse) => [warehouse.name, warehouse.code]));
      const keys = new Map<string, number>();

      for (const row of rows) {
        if (duplicateAllergenNames.has(row.allergenName)) {
          throw new ReceivingImportError(`${row.rowNumber}행 시약명: 같은 이름의 시약이 여러 개입니다. 시약 정보를 정리한 후 다시 시도하세요.`);
        }
        const allergenId = allergenByName.get(row.allergenName);
        if (!allergenId) {
          throw new ReceivingImportError(`${row.rowNumber}행 시약명: 사용 중인 시약을 찾을 수 없습니다.`);
        }
        if (!warehouseCodeByName.has(row.warehouseName)) {
          throw new ReceivingImportError(`${row.rowNumber}행 입고창고명: 사용 중인 창고를 찾을 수 없습니다.`);
        }
        const key = `${allergenId}\u0000${row.lotNo}\u0000${row.expirationDate.toISOString()}`;
        const firstRow = keys.get(key);
        if (firstRow) {
          throw new ReceivingImportError(`${row.rowNumber}행: ${firstRow}행과 동일한 입고분입니다.`);
        }
        keys.set(key, row.rowNumber);
      }

      const existingLots = await tx.reagentLot.findMany({
        where: {
          OR: rows.map((row) => ({
            allergenId: allergenByName.get(row.allergenName)!,
            lotNo: row.lotNo,
            expirationDate: row.expirationDate
          }))
        },
        select: { allergenId: true, lotNo: true, expirationDate: true }
      });
      if (existingLots.length > 0) {
        const duplicate = existingLots[0];
        const row = rows.find((candidate) =>
          allergenByName.get(candidate.allergenName) === duplicate.allergenId &&
          candidate.lotNo === duplicate.lotNo &&
          candidate.expirationDate.getTime() === duplicate.expirationDate.getTime()
        );
        throw new ReceivingImportError(`${row?.rowNumber ?? "?"}행: 이미 등록된 입고분입니다.`);
      }

      for (const row of rows) {
        const lot = await tx.reagentLot.create({
          data: {
            allergenId: allergenByName.get(row.allergenName)!,
            lotNo: row.lotNo,
            receivedDate: row.receivedDate,
            expirationDate: row.expirationDate,
            initialQuantity: row.quantity,
            memo: row.memo || null,
            isActive: true
          }
        });
        await tx.warehouseStock.create({
          data: { reagentLotId: lot.id, warehouse: warehouseCodeByName.get(row.warehouseName)!, quantity: row.quantity }
        });
        await tx.stockMovement.create({
          data: {
            reagentLotId: lot.id,
            type: "IN",
            quantity: row.quantity,
            warehouse: warehouseCodeByName.get(row.warehouseName)!,
            destinationWarehouse: null,
            reason: row.memo || "엑셀 일괄 입고 등록",
            refType: "RECEIVING_IMPORT",
            refId: lot.id,
            createdBy: user.id
          }
        });
      }

      await tx.auditLog.create({
        data: {
          action: "RECEIVING_IMPORT",
          entityType: "RECEIVING",
          description: `입고 엑셀 일괄 등록 ${rows.length}건 (${file.name.slice(0, 120)})`,
          actorId: user.id
        }
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 20_000 });

    revalidatePath("/lots");
    revalidatePath("/movements");
    revalidatePath("/receiving");
    revalidatePath("/shipments");
    revalidatePath("/replacements");
    return redirectWithFlash("/receiving", "success", `${rows.length}건의 입고를 일괄 등록했습니다.`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ReceivingImportError) await fail(error.message);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      await fail("등록 중 다른 요청과 중복된 입고분이 생겼습니다. 파일을 다시 확인하세요.");
    }
    await fail("엑셀 입고 등록 중 오류가 발생했습니다. 파일과 연결 상태를 확인하세요.");
  }
}
