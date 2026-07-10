import { prisma } from "@/lib/prisma";

const actionLabels: Record<string, string> = {
  ORDER_CANCEL: "주문 취소",
  SHIPMENT_CREATE: "출고 처리",
  SHIPMENT_CANCEL: "출고 취소",
  USER_ACTIVATE: "사용자 활성화",
  USER_DEACTIVATE: "사용자 비활성화",
  USER_PASSWORD_RESET: "비밀번호 재설정",
  USER_CREATE: "사용자 등록"
};

export async function getAuditRows() {
  const rows = await prisma.auditLog.findMany({
    include: { actor: { select: { name: true, loginId: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return rows.map((row) => ({
    id: row.id,
    date: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(row.createdAt),
    action: actionLabels[row.action] ?? row.action,
    entityType: row.entityType,
    description: row.description,
    actor: `${row.actor.name} (${row.actor.loginId})`
  }));
}
