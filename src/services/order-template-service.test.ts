import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOrderTemplate,
  listActiveOrderTemplates,
  setOrderTemplateActive,
  updateOrderTemplate
} from "./order-template-service";

function testDb(tx: object) {
  return {
    $transaction: vi.fn(async (operation: (value: object) => Promise<unknown>) => operation(tx))
  } as unknown as PrismaClient;
}

function persistedTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    name: "정기 세트",
    nameKey: "정기 세트",
    description: null,
    isActive: true,
    sortOrder: 0,
    version: 1,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: new Date("2026-07-12T00:00:00Z"),
    updatedAt: new Date("2026-07-12T00:00:00Z"),
    items: [],
    creator: { id: "user-1", loginId: "admin", name: "관리자" },
    updater: { id: "user-1", loginId: "admin", name: "관리자" },
    ...overrides
  };
}

describe("order template service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a lean projection for templates shown on the order form", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      orderTemplate: {
        findMany
      }
    } as unknown as PrismaClient;

    await listActiveOrderTemplates(db, "EGG");

    expect(findMany).toHaveBeenCalledOnce();
    const query = findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ isActive: true });
    expect(query.select).toMatchObject({
      id: true,
      name: true,
      description: true,
      items: {
        select: {
          allergenId: true,
          quantity: true
        }
      }
    });
    expect(query.select).not.toHaveProperty("creator");
    expect(query.select).not.toHaveProperty("updater");
  });

  it("creates normalized items and its audit record in one transaction", async () => {
    const tx = {
      allergen: {
        count: vi.fn().mockResolvedValue(2)
      },
      orderTemplate: {
        create: vi.fn().mockResolvedValue({ id: "template-1" }),
        findUnique: vi.fn().mockResolvedValue(persistedTemplate())
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" })
      }
    };

    await createOrderTemplate(testDb(tx), {
      name: "  Ａ 세트 ",
      description: "  설명 ",
      items: [
        { allergenId: " allergen-1 ", quantity: "2" },
        { allergenId: "allergen-2", quantity: 3 }
      ],
      actorId: " user-1 "
    });

    expect(tx.orderTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "A 세트",
        nameKey: "a 세트",
        description: "설명",
        createdBy: "user-1",
        updatedBy: "user-1",
        items: {
          create: [
            { allergenId: "allergen-1", quantity: 2, position: 0 },
            { allergenId: "allergen-2", quantity: 3, position: 1 }
          ]
        }
      }),
      select: {
        id: true
      }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ORDER_TEMPLATE_CREATE",
        entityType: "ORDER_TEMPLATE",
        entityId: "template-1",
        actorId: "user-1"
      })
    });
  });

  it("rejects a set when any referenced allergen is missing or inactive", async () => {
    const tx = {
      allergen: {
        count: vi.fn().mockResolvedValue(0)
      },
      orderTemplate: {
        create: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };

    await expect(
      createOrderTemplate(testDb(tx), {
        name: "정기 세트",
        items: [{ allergenId: "inactive-allergen", quantity: 1 }],
        actorId: "user-1"
      })
    ).rejects.toThrow("TEMPLATE_INACTIVE_ALLERGEN");
    expect(tx.orderTemplate.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("maps a database uniqueness race to a stable duplicate-name error", async () => {
    const db = {
      $transaction: vi.fn().mockRejectedValue({ code: "P2002" })
    } as unknown as PrismaClient;

    await expect(
      createOrderTemplate(db, {
        name: "중복 세트",
        items: [{ allergenId: "allergen-1", quantity: 1 }],
        actorId: "user-1"
      })
    ).rejects.toThrow("TEMPLATE_NAME_DUPLICATE");
  });

  it("replaces items under a version compare-and-swap and preserves sort order when omitted", async () => {
    const tx = {
      allergen: {
        count: vi.fn().mockResolvedValue(1)
      },
      orderTemplate: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "template-1",
            name: "기존 세트",
            sortOrder: 7,
            version: 2,
            items: [{ allergenId: "allergen-old" }]
          })
          .mockResolvedValueOnce(persistedTemplate({ version: 3, sortOrder: 7 })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      orderTemplateItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" })
      }
    };

    await updateOrderTemplate(testDb(tx), {
      id: "template-1",
      expectedVersion: 2,
      name: "변경 세트",
      description: null,
      items: [{ allergenId: "allergen-new", quantity: "4" }],
      actorId: "user-1"
    });

    expect(tx.orderTemplate.updateMany).toHaveBeenCalledWith({
      where: {
        id: "template-1",
        version: 2
      },
      data: expect.objectContaining({
        sortOrder: 7,
        version: {
          increment: 1
        }
      })
    });
    expect(tx.orderTemplateItem.deleteMany).toHaveBeenCalledOnce();
    expect(tx.orderTemplateItem.createMany).toHaveBeenCalledWith({
      data: [{ templateId: "template-1", allergenId: "allergen-new", quantity: 4, position: 0 }]
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ORDER_TEMPLATE_UPDATE",
        entityId: "template-1"
      })
    });
  });

  it("rejects a stale editor before replacing any items", async () => {
    const tx = {
      allergen: {
        count: vi.fn()
      },
      orderTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          id: "template-1",
          name: "최신 세트",
          sortOrder: 0,
          version: 3,
          items: [{ allergenId: "allergen-1" }]
        }),
        updateMany: vi.fn()
      },
      orderTemplateItem: {
        deleteMany: vi.fn(),
        createMany: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };

    await expect(
      updateOrderTemplate(testDb(tx), {
        id: "template-1",
        expectedVersion: 2,
        name: "오래된 수정",
        items: [{ allergenId: "allergen-1", quantity: 1 }],
        actorId: "user-1"
      })
    ).rejects.toThrow("TEMPLATE_VERSION_CONFLICT");
    expect(tx.allergen.count).not.toHaveBeenCalled();
    expect(tx.orderTemplate.updateMany).not.toHaveBeenCalled();
    expect(tx.orderTemplateItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not reactivate a set containing an inactive allergen", async () => {
    const tx = {
      allergen: {
        count: vi.fn().mockResolvedValue(0)
      },
      orderTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          id: "template-1",
          name: "중단 세트",
          sortOrder: 0,
          version: 1,
          items: [{ allergenId: "inactive-allergen" }]
        }),
        updateMany: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };

    await expect(
      setOrderTemplateActive(testDb(tx), {
        id: "template-1",
        expectedVersion: 1,
        isActive: true,
        actorId: "user-1"
      })
    ).rejects.toThrow("TEMPLATE_INACTIVE_ALLERGEN");
    expect(tx.orderTemplate.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
