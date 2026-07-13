"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { redirectWithFlash } from "@/lib/flash-message";
import { formString, formStrings } from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createOrderTemplate as createTemplate,
  setOrderTemplateActive as setTemplateActive,
  updateOrderTemplate as updateTemplate
} from "@/services/order-template-service";

const TEMPLATE_PATH = "/orders/templates";

async function fail(message: string): Promise<never> {
  return redirectWithFlash(TEMPLATE_PATH, "error", message);
}

function templateItems(formData: FormData) {
  const allergenIds = formStrings(formData, "allergenId");
  const quantities = formStrings(formData, "quantity");
  const itemCount = Math.max(allergenIds.length, quantities.length);

  return Array.from({ length: itemCount }, (_, position) => ({
    allergenId: allergenIds[position] ?? "",
    quantity: quantities[position] ?? "",
    position
  }));
}

function positiveInteger(formData: FormData, key: string) {
  const raw = formString(formData, key);
  const value = Number(raw);

  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value) || value > 2_147_483_647) {
    throw new Error("TEMPLATE_VERSION_INVALID");
  }

  return value;
}

function templateErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "주문 세트 처리 중 오류가 발생했습니다.";

  const messages: Record<string, string> = {
    FORBIDDEN: "주문 세트 관리 권한이 없습니다.",
    PASSWORD_CHANGE_REQUIRED: "비밀번호를 먼저 변경하세요.",
    TEMPLATE_NAME_REQUIRED: "세트명을 입력하세요.",
    TEMPLATE_NAME_TOO_LONG: "세트명은 100자 이하로 입력하세요.",
    TEMPLATE_DESCRIPTION_TOO_LONG: "설명은 500자 이하로 입력하세요.",
    TEMPLATE_ITEM_REQUIRED: "시약을 한 개 이상 담아야 합니다.",
    TEMPLATE_ITEM_ALLERGEN_REQUIRED: "모든 품목의 시약을 선택하세요.",
    TEMPLATE_ITEM_ALLERGEN_DUPLICATE: "같은 시약을 세트에 중복으로 담을 수 없습니다.",
    TEMPLATE_ITEM_QUANTITY_INVALID: "기본 수량은 1 이상의 정수로 입력하세요.",
    TEMPLATE_ITEM_LIMIT_EXCEEDED: "한 세트에 담을 수 있는 품목 수를 초과했습니다.",
    TEMPLATE_NOT_FOUND: "주문 세트를 찾을 수 없습니다.",
    TEMPLATE_ID_REQUIRED: "처리할 주문 세트를 찾을 수 없습니다.",
    TEMPLATE_NAME_DUPLICATE: "이미 사용 중인 주문 세트명입니다.",
    TEMPLATE_VERSION_INVALID: "화면의 주문 세트 버전을 확인할 수 없습니다. 새로고침한 뒤 다시 시도하세요.",
    TEMPLATE_VERSION_CONFLICT: "다른 사용자가 먼저 수정했습니다. 화면을 새로고침한 뒤 다시 시도하세요.",
    TEMPLATE_INACTIVE_ALLERGEN: "비활성 시약이 포함되어 있습니다. 해당 품목을 교체하거나 제거하세요.",
    TEMPLATE_ACTIVE_INVALID: "변경할 주문 세트 상태를 확인할 수 없습니다.",
    TRANSACTION_CONFLICT: "다른 작업과 겹쳤습니다. 화면을 새로고침한 뒤 다시 시도하세요."
  };

  return messages[error.message] ?? "주문 세트 처리 중 오류가 발생했습니다.";
}

function revalidateTemplatePaths() {
  revalidatePath(TEMPLATE_PATH);
  revalidatePath("/orders/new");
}

export async function createOrderTemplate(formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    await createTemplate(prisma, {
      name: formString(formData, "name"),
      description: formString(formData, "description"),
      items: templateItems(formData),
      actorId: user.id
    });
  } catch (error) {
    unstable_rethrow(error);
    await fail(templateErrorMessage(error));
  }

  revalidateTemplatePaths();
  await redirectWithFlash(TEMPLATE_PATH, "success", "주문 세트가 등록되었습니다.");
}

export async function updateOrderTemplate(formData: FormData) {
  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    const id = formString(formData, "templateId");
    if (!id) throw new Error("TEMPLATE_ID_REQUIRED");

    const expectedVersion = positiveInteger(formData, "expectedVersion");
    await updateTemplate(prisma, {
      id,
      expectedVersion,
      name: formString(formData, "name"),
      description: formString(formData, "description"),
      items: templateItems(formData),
      actorId: user.id
    });
  } catch (error) {
    unstable_rethrow(error);
    await fail(templateErrorMessage(error));
  }

  revalidateTemplatePaths();
  await redirectWithFlash(TEMPLATE_PATH, "success", "주문 세트가 수정되었습니다.");
}

export async function setOrderTemplateActive(formData: FormData) {
  let isActive = false;

  try {
    const user = await requireRole(["ADMIN", "ORDER_MANAGER"]);
    const id = formString(formData, "templateId");
    const activeValue = formString(formData, "isActive");

    if (!id) throw new Error("TEMPLATE_ID_REQUIRED");
    if (activeValue !== "true" && activeValue !== "false") {
      throw new Error("TEMPLATE_ACTIVE_INVALID");
    }

    const expectedVersion = positiveInteger(formData, "expectedVersion");
    isActive = activeValue === "true";
    await setTemplateActive(prisma, { id, expectedVersion, isActive, actorId: user.id });
  } catch (error) {
    unstable_rethrow(error);
    await fail(templateErrorMessage(error));
  }

  revalidateTemplatePaths();
  await redirectWithFlash(
    TEMPLATE_PATH,
    "success",
    isActive ? "주문 세트가 활성화되었습니다." : "주문 세트가 비활성화되었습니다."
  );
}
