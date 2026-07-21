import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, pageMeta } from "@/lib/pagination";

const actionLabels: Record<string, string> = {
  ORDER_CANCEL: "주문 취소",
  SHIPMENT_CREATE: "출고 처리",
  SHIPMENT_CANCEL: "출고 취소",
  STOCK_TRANSFER: "창고 간 재고이동",
  USER_ACTIVATE: "사용자 활성화",
  USER_DEACTIVATE: "사용자 비활성화",
  USER_PASSWORD_RESET: "비밀번호 재설정",
  USER_CREATE: "사용자 등록",
  INVENTORY_EXPORT: "재고현황 엑셀 생성",
  MOVEMENT_EXPORT: "입출고이력 엑셀 생성",
  ORDER_EXPORT: "주문내역 엑셀 생성",
  COMBINED_EXPORT: "업무자료 통합 엑셀 생성"
};

export async function getAuditRows(requestedPage: number, q = "") {
  const where = q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }, { actor: { is: { name: { contains: q, mode: "insensitive" as const } } } }] } : {};
  const requestedSkip = (Math.max(1, requestedPage) - 1) * PAGE_SIZE;
  const auditQuery = {
    where, include: { actor: { select: { name: true, loginId: true } } },
    orderBy: { createdAt: "desc" },
    skip: requestedSkip,
    take: PAGE_SIZE
  } satisfies Prisma.AuditLogFindManyArgs;
  const [total, initialRows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany(auditQuery)
  ]);
  const meta = pageMeta(requestedPage, total);
  const rows = meta.skip === requestedSkip
    ? initialRows
    : await prisma.auditLog.findMany({ ...auditQuery, skip: meta.skip });

  return { ...meta, rows: rows.map((row) => ({
    id: row.id,
    date: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(row.createdAt),
    action: actionLabels[row.action] ?? row.action,
    entityType: row.entityType,
    description: row.description,
    actor: `${row.actor.name} (${row.actor.loginId})`
  })) };
}
