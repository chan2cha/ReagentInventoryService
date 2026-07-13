import "server-only";

/** 최소 재고와 LOT 수량을 조인 비교해야 하는 상태 필터를 DB에서 페이지 단위로 실행한다. */

import { Prisma, type PrismaClient } from "@prisma/client";
import { addDateOnlyDays, koreaDateKey } from "@/lib/date";
import type { LotStatusKind } from "@/domain/lot-status";

type StatusFilteredLotQueryClient = Pick<PrismaClient, "$queryRaw">;

export type StatusFilteredLotRecord = {
  id: string;
  lotNo: string;
  receivedDate: Date;
  expirationDate: Date;
  initialQuantity: number;
  currentQuantity: number;
  memo: string | null;
  isActive: boolean;
  allergenName: string;
  allergenCode: string;
  allergenCategory: string | null;
  minStock: number;
};

type StatusFilteredLotQueryOptions = {
  q?: string;
  status: Extract<LotStatusKind, "LOW_STOCK" | "NORMAL">;
  now: Date;
};

function statusFilteredLotFromWhere({ q, status, now }: StatusFilteredLotQueryOptions) {
  // 만료·품절·임박 상태는 기존 상태 판정에서 먼저 제외되므로 재고 상태 조건만 남긴다.
  const afterExpiring = addDateOnlyDays(koreaDateKey(now), 31);
  const query = q?.trim() ?? "";
  const searchCondition = query
    ? Prisma.sql`
        AND (
          lot."lotNo" ILIKE ${`%${query}%`}
          OR allergen."name" ILIKE ${`%${query}%`}
          OR allergen."code" ILIKE ${`%${query}%`}
        )`
    : Prisma.empty;
  const inventoryCondition = status === "LOW_STOCK"
    ? Prisma.sql`
        AND allergen."minStock" > 0
        AND lot."currentQuantity" < allergen."minStock"`
    : Prisma.sql`
        AND (allergen."minStock" <= 0 OR lot."currentQuantity" >= allergen."minStock")`;

  return Prisma.sql`
    FROM "ReagentLot" AS lot
    INNER JOIN "Allergen" AS allergen ON allergen."id" = lot."allergenId"
    WHERE lot."expirationDate" >= ${afterExpiring}
      AND lot."currentQuantity" <> 0
      ${inventoryCondition}
      ${searchCondition}`;
}

export async function countStatusFilteredLots(
  db: StatusFilteredLotQueryClient,
  options: StatusFilteredLotQueryOptions
) {
  // 목록의 페이지 보정에 필요한 전체 건수도 같은 SQL 조건으로 계산해야 한다.
  const rows = await db.$queryRaw<Array<{ total: bigint }>>(
    Prisma.sql`SELECT COUNT(*) AS "total" ${statusFilteredLotFromWhere(options)}`
  );

  return rows[0] ? Number(rows[0].total) : 0;
}

export async function listStatusFilteredLots(
  db: StatusFilteredLotQueryClient,
  options: StatusFilteredLotQueryOptions & { skip?: number; take: number }
) {
  // SQL에서 정렬·LIMIT/OFFSET까지 수행해 애플리케이션의 후보 전체 스캔을 막는다.
  const { skip = 0, take, ...filters } = options;

  return db.$queryRaw<StatusFilteredLotRecord[]>(Prisma.sql`
    SELECT
      lot."id",
      lot."lotNo",
      lot."receivedDate",
      lot."expirationDate",
      lot."initialQuantity",
      lot."currentQuantity",
      lot."memo",
      lot."isActive",
      allergen."name" AS "allergenName",
      allergen."code" AS "allergenCode",
      allergen."category" AS "allergenCategory",
      allergen."minStock" AS "minStock"
    ${statusFilteredLotFromWhere(filters)}
    ORDER BY lot."expirationDate" ASC, lot."lotNo" ASC, lot."id" ASC
    LIMIT ${take} OFFSET ${skip}
  `);
}
