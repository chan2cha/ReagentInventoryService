import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findClients: vi.fn(),
  findAllergens: vi.fn()
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

import { getOrderFormData } from "./order-form-data";

describe("getOrderFormData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findClients.mockResolvedValue([
      { id: "client-1", name: "거래처", region: "서울 강남구", managerName: "담당자", deliveryDepartment: "진단검사의학과" }
    ]);
    mocks.findAllergens.mockResolvedValue([
      { id: "allergen-1", code: "A-1", name: "시약", category: "검사" }
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("maps active clients and reagents into the order form DTO", async () => {
    await expect(getOrderFormData()).resolves.toEqual({
      clients: [{ id: "client-1", name: "거래처", region: "서울 강남구", manager: "담당자", deliveryDepartment: "진단검사의학과" }],
      allergens: [{ id: "allergen-1", code: "A-1", name: "시약" }]
    });

    expect(mocks.findClients).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });
    expect(mocks.findAllergens).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { code: "asc" }]
    });
  });

  it("uses the standard data-source fallback when form data cannot be loaded", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SAMPLE_DATA", "true");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findClients.mockRejectedValue(new Error("database unavailable"));

    await expect(getOrderFormData()).resolves.toEqual({
      clients: [],
      allergens: []
    });
  });
});
