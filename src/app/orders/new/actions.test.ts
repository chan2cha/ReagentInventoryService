import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reapplyOrderTemplateToDraft,
  selectOrderTemplateInDraft
} from "@/domain/order-draft";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createOrderValue: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { kind: "test-db" } }));
vi.mock("@/services/order-create-service", () => ({
  createOrderValue: mocks.createOrderValue
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createOrder } from "./actions";

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

describe("create order action with an applied order set", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
    mocks.createOrderValue.mockResolvedValue({ id: "order-1" });
  });

  it("submits the idempotently merged draft and preserves the success redirect", async () => {
    let nextRowId = 10;
    const templateItems = [
      { allergenId: "allergen-set-1", quantity: 2 },
      { allergenId: "allergen-set-2", quantity: 3 }
    ];
    const firstDraft = selectOrderTemplateInDraft([
      { rowId: 1, allergenId: "allergen-manual", quantity: "7" },
      { rowId: 2, allergenId: "", quantity: "" }
    ], "template-1", templateItems, () => nextRowId++);
    const submittedDraft = reapplyOrderTemplateToDraft(
      firstDraft,
      "template-1",
      templateItems,
      () => nextRowId++
    );
    const data = new FormData();
    data.set("clientId", "client-1");
    data.set("memo", "세트 주문");
    for (const row of submittedDraft) {
      data.append("allergenId", row.allergenId);
      data.append("quantity", row.quantity);
    }

    const error = await captureThrown(createOrder(data));

    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "ORDER_MANAGER"]);
    expect(mocks.createOrderValue).toHaveBeenCalledWith(
      { kind: "test-db" },
      {
        clientId: "client-1",
        memo: "세트 주문",
        actorId: "user-1",
        items: [
          { allergenId: "allergen-manual", quantity: 7 },
          { allergenId: "allergen-set-1", quantity: 2 },
          { allergenId: "allergen-set-2", quantity: 3 }
        ]
      }
    );
    // A direct function call has no Server Action request context, so Next uses
    // its generic 307 digest here; the HTTP Server Action runtime converts it to
    // the 303 response already covered by the built-server regression test.
    expect(redirectDigest(error)).toMatch(/\/orders;30[37];/);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
  });
});
