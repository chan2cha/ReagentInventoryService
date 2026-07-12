import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findClients: vi.fn(),
  findAllergens: vi.fn(),
  listActiveOrderTemplates: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findMany: mocks.findClients
    },
    allergen: {
      findMany: mocks.findAllergens
    }
  }
}));

vi.mock("@/services/order-template-service", () => ({
  listActiveOrderTemplates: mocks.listActiveOrderTemplates
}));

import { getOrderFormData } from "./order-form-data";

describe("getOrderFormData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findClients.mockResolvedValue([
      { id: "client-1", name: "거래처", managerName: "담당자" }
    ]);
    mocks.findAllergens.mockResolvedValue([
      { id: "allergen-1", code: "A-1", name: "시약", category: "검사" }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps active templates into the order form DTO", async () => {
    mocks.listActiveOrderTemplates.mockResolvedValue([
      {
        id: "template-1",
        name: "기본 세트",
        description: "설명",
        items: [
          {
            allergenId: "allergen-1",
            quantity: 2,
            allergen: { id: "allergen-1", code: "A-1", name: "시약", isActive: true }
          }
        ]
      }
    ]);

    await expect(getOrderFormData()).resolves.toEqual({
      clients: [{ id: "client-1", name: "거래처", manager: "담당자" }],
      allergens: [{ id: "allergen-1", code: "A-1", name: "시약" }],
      templates: [
        {
          id: "template-1",
          name: "기본 세트",
          description: "설명",
          items: [
            {
              allergenId: "allergen-1",
              quantity: 2,
              allergen: { id: "allergen-1", code: "A-1", name: "시약", isActive: true }
            }
          ]
        }
      ],
      templateLoadFailed: false
    });
  });

  it("keeps manual ordering available when only the template query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listActiveOrderTemplates.mockRejectedValue(new Error("template table unavailable"));

    await expect(getOrderFormData()).resolves.toEqual({
      clients: [{ id: "client-1", name: "거래처", manager: "담당자" }],
      allergens: [{ id: "allergen-1", code: "A-1", name: "시약" }],
      templates: [],
      templateLoadFailed: true
    });
  });
});
