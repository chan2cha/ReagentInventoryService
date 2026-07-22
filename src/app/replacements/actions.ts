"use server";

import type { ReturnDisposition } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash-message";
import { prisma } from "@/lib/prisma";
import { completeReplacement, confirmReplacement, REPLACEMENT_POLICY_ID } from "@/services/replacement-service";

function value(data: FormData, key: string) { const entry = data.get(key); return typeof entry === "string" ? entry.trim() : ""; }
async function fail(message: string): Promise<never> { return redirectWithFlash("/replacements", "error", message); }
function refresh() { revalidatePath("/replacements"); revalidatePath("/lots"); revalidatePath("/movements"); }

export async function confirmProactiveReplacement(data: FormData) {
  const shipmentItemId = value(data, "shipmentItemId");
  const quantity = Number(value(data, "quantity"));
  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await confirmReplacement(prisma, { shipmentItemId, quantity, actorId: user.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { REPLACEMENT_QUANTITY_INVALID: "확인 잔량은 1개 이상이어야 합니다.", REPLACEMENT_QUANTITY_EXCEEDS_SHIPMENT: "확인 잔량이 원출고 수량보다 많습니다.", REPLACEMENT_ALREADY_EXISTS: "이미 처리된 출고 품목입니다." };
    await fail(messages[code] ?? "교환 확정 중 오류가 발생했습니다.");
  }
  refresh();
  await redirectWithFlash("/replacements", "success", " 교환 수량이 확정되었습니다.");
}

export async function excludeProactiveReplacement(data: FormData) {
  const reason = value(data, "reason");
  if (!reason) return fail("교환 제외 사유를 입력하세요.");
  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await confirmReplacement(prisma, { shipmentItemId: value(data, "shipmentItemId"), quantity: 1, actorId: user.id, excludeReason: reason });
  } catch { await fail("교환 제외 처리 중 오류가 발생했습니다."); }
  refresh();
  await redirectWithFlash("/replacements", "success", "교환 제외 이력이 저장되었습니다.");
}

export async function shipProactiveReplacement(data: FormData) {
  const disposition = value(data, "disposition") as ReturnDisposition;
  if (!(["COLLECTED_DISPOSED", "CLIENT_DISPOSED", "NOT_COLLECTED"] as string[]).includes(disposition)) return fail("기존품 처리 결과를 선택하세요.");
  try {
    const user = await requireRole(["ADMIN", "SHIPMENT_MANAGER"]);
    await completeReplacement(prisma, { replacementId: value(data, "replacementId"), disposition, actorId: user.id });
  } catch (error) {
    const message = error instanceof Error && error.message === "REPLACEMENT_STOCK_INSUFFICIENT" ? "최소 잔여 유통기한을 만족하는 교환 재고가 부족합니다." : "교환품 출고 중 오류가 발생했습니다.";
    await fail(message);
  }
  refresh();
  await redirectWithFlash("/replacements", "success", "교환품 출고와 기존품 처리가 완료되었습니다.");
}

export async function updateReplacementPolicy(data: FormData) {
  const detectionDays = Number(value(data, "detectionDays"));
  const minimumDeliveryShelfDays = Number(value(data, "minimumDeliveryShelfDays"));
  if (![detectionDays, minimumDeliveryShelfDays].every((day) => Number.isSafeInteger(day) && day >= 1 && day <= 3650)) {
    return fail("알림일과 최소 잔여 유통기한은 1~3,650일의 정수로 입력하세요.");
  }
  try {
    const user = await requireRole(["ADMIN"]);
    await prisma.$transaction(async (tx) => {
      await tx.replacementPolicy.update({
        where: { id: REPLACEMENT_POLICY_ID },
        data: { detectionDays, minimumDeliveryShelfDays }
      });
      await tx.auditLog.create({ data: {
        action: "REPLACEMENT_POLICY_UPDATE", entityType: "REPLACEMENT_POLICY", entityId: REPLACEMENT_POLICY_ID,
        description: ` 교환 알림 ${detectionDays}일 전, 교환품 최소 잔여 유통기한 ${minimumDeliveryShelfDays}일`, actorId: user.id
      }});
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return fail(" 교환 기준 변경 권한이 없습니다.");
    await fail(" 교환 기준 저장 중 오류가 발생했습니다.");
  }
  refresh();
  await redirectWithFlash("/replacements", "success", " 교환 기준이 저장되었습니다.");
}
