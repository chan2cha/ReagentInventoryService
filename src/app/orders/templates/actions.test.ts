import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createOrderTemplate: vi.fn(),
  updateOrderTemplate: vi.fn(),
  setOrderTemplateActive: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { kind: "test-db" } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/services/order-template-service", () => ({
  createOrderTemplate: mocks.createOrderTemplate,
  updateOrderTemplate: mocks.updateOrderTemplate,
  setOrderTemplateActive: mocks.setOrderTemplateActive
}));

import {
  createOrderTemplate,
  setOrderTemplateActive,
  updateOrderTemplate
} from "./actions";

async function captureThrown(run: Promise<unknown>) {
  try {
    await run;
  } catch (error) {
    return error;
  }

  throw new Error("Expected action redirect");
}

function redirectDigest(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : "";
}

describe("order template actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
  });

  it("passes ordered item rows and the authenticated actor to creation service", async () => {
    const data = new FormData();
    data.set("name", "  정기 검사 세트  ");
    data.set("description", "  기본 구성  ");
    data.append("allergenId", "allergen-1");
    data.append("quantity", "2");
    data.append("allergenId", "allergen-2");
    data.append("quantity", "5");

    const error = await captureThrown(createOrderTemplate(data));

    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "ORDER_MANAGER"]);
    expect(mocks.createOrderTemplate).toHaveBeenCalledWith(
      { kind: "test-db" },
      {
        name: "정기 검사 세트",
        description: "기본 구성",
        actorId: "user-1",
        items: [
          { allergenId: "allergen-1", quantity: "2", position: 0 },
          { allergenId: "allergen-2", quantity: "5", position: 1 }
        ]
      }
    );
    expect(redirectDigest(error)).toContain("success=");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/new");
  });

  it("maps optimistic version conflicts to a safe redirect message", async () => {
    mocks.updateOrderTemplate.mockRejectedValue(new Error("TEMPLATE_VERSION_CONFLICT"));
    const data = new FormData();
    data.set("templateId", "template-1");
    data.set("expectedVersion", "3");
    data.set("name", "정기 검사 세트");
    data.append("allergenId", "allergen-1");
    data.append("quantity", "2");

    const error = await captureThrown(updateOrderTemplate(data));
    const digest = redirectDigest(error);

    expect(digest).toContain("/orders/templates?error=");
    expect(digest).not.toContain("다른 사용자가");
    expect(decodeURIComponent(digest)).toContain("다른 사용자가 먼저 수정했습니다.");
  });

  it("uses the submitted target state instead of toggling stale database state", async () => {
    const data = new FormData();
    data.set("templateId", "template-1");
    data.set("expectedVersion", "4");
    data.set("isActive", "false");

    await captureThrown(setOrderTemplateActive(data));

    expect(mocks.setOrderTemplateActive).toHaveBeenCalledWith(
      { kind: "test-db" },
      { id: "template-1", expectedVersion: 4, isActive: false, actorId: "user-1" }
    );
  });

  it("rejects a non-canonical optimistic-lock version before calling the service", async () => {
    const data = new FormData();
    data.set("templateId", "template-1");
    data.set("expectedVersion", "1e2");
    data.set("isActive", "false");

    const error = await captureThrown(setOrderTemplateActive(data));

    expect(redirectDigest(error)).toContain("/orders/templates?error=");
    expect(mocks.setOrderTemplateActive).not.toHaveBeenCalled();
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "ORDER_MANAGER"]);
  });
});
