import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  normalizeOrderTemplateDescription,
  normalizeOrderTemplateInput,
  normalizeOrderTemplateItems,
  normalizeOrderTemplateName,
  normalizeOrderTemplateSortOrder,
  type RawOrderTemplateItemInput
} from "../domain/order-template";
import { runSerializableTransaction } from "../lib/transaction";

type ListOrderTemplatesOptions = {
  includeInactive?: boolean;
  q?: string;
};

export type CreateOrderTemplateInput = {
  name: string;
  description?: string | null;
  sortOrder?: string | number;
  items: RawOrderTemplateItemInput[];
  actorId: string;
};

export type UpdateOrderTemplateInput = CreateOrderTemplateInput & {
  id: string;
  expectedVersion: number;
};

export type SetOrderTemplateActiveInput = {
  id: string;
  expectedVersion: number;
  isActive: boolean;
  actorId: string;
};

const templateInclude = {
  items: {
    orderBy: {
      position: "asc"
    },
    include: {
      allergen: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true
        }
      }
    }
  },
  creator: {
    select: {
      id: true,
      loginId: true,
      name: true
    }
  },
  updater: {
    select: {
      id: true,
      loginId: true,
      name: true
    }
  }
} satisfies Prisma.OrderTemplateInclude;

const orderFormTemplateSelect = {
  id: true,
  name: true,
  description: true,
  items: {
    orderBy: {
      position: "asc"
    },
    select: {
      allergenId: true,
      quantity: true,
      allergen: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true
        }
      }
    }
  }
} satisfies Prisma.OrderTemplateSelect;

const templateOrderBy = [
  {
    sortOrder: "asc" as const
  },
  {
    name: "asc" as const
  },
  {
    id: "asc" as const
  }
];

function normalizeIdentifier(value: string, errorCode: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(errorCode);
  }

  return normalized;
}

function normalizeExpectedVersion(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new Error("TEMPLATE_VERSION_INVALID");
  }

  return value;
}

function prismaErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function mapTemplateWriteError(error: unknown): never {
  if (prismaErrorCode(error) === "P2002") {
    throw new Error("TEMPLATE_NAME_DUPLICATE");
  }

  throw error;
}

function orderTemplateWhere(options: ListOrderTemplatesOptions): Prisma.OrderTemplateWhereInput {
  const q = options.q?.normalize("NFKC").trim() ?? "";

  return {
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive" as const
              }
            },
            {
              description: {
                contains: q,
                mode: "insensitive" as const
              }
            },
            {
              items: {
                some: {
                  allergen: {
                    OR: [
                      {
                        code: {
                          contains: q,
                          mode: "insensitive" as const
                        }
                      },
                      {
                        name: {
                          contains: q,
                          mode: "insensitive" as const
                        }
                      }
                    ]
                  }
                }
              }
            }
          ]
        }
      : {})
  };
}

async function assertActiveAllergens(
  tx: Prisma.TransactionClient,
  items: Array<{ allergenId: string }>
) {
  if (items.length < 1) {
    throw new Error("TEMPLATE_ITEM_REQUIRED");
  }

  const allergenIds = items.map((item) => item.allergenId);
  const activeAllergenCount = await tx.allergen.count({
    where: {
      id: {
        in: allergenIds
      },
      isActive: true
    }
  });

  if (activeAllergenCount !== allergenIds.length) {
    throw new Error("TEMPLATE_INACTIVE_ALLERGEN");
  }
}

async function findTemplateOrThrow(tx: Prisma.TransactionClient, id: string) {
  const template = await tx.orderTemplate.findUnique({
    where: {
      id
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      version: true,
      items: {
        select: {
          allergenId: true
        }
      }
    }
  });

  if (!template) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }

  return template;
}

async function returnWrittenTemplate(tx: Prisma.TransactionClient, id: string) {
  const template = await tx.orderTemplate.findUnique({
    where: {
      id
    },
    include: templateInclude
  });

  if (!template) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }

  return template;
}

export async function listOrderTemplates(
  db: PrismaClient,
  options: ListOrderTemplatesOptions = {}
) {
  return db.orderTemplate.findMany({
    where: orderTemplateWhere(options),
    include: templateInclude,
    orderBy: templateOrderBy
  });
}

export function listActiveOrderTemplates(db: PrismaClient, q?: string) {
  return db.orderTemplate.findMany({
    where: orderTemplateWhere({ q, includeInactive: false }),
    select: orderFormTemplateSelect,
    orderBy: templateOrderBy
  });
}

export async function getOrderTemplate(db: PrismaClient, id: string) {
  const templateId = normalizeIdentifier(id, "TEMPLATE_ID_REQUIRED");
  const template = await db.orderTemplate.findUnique({
    where: {
      id: templateId
    },
    include: templateInclude
  });

  if (!template) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }

  return template;
}

export async function createOrderTemplate(db: PrismaClient, input: CreateOrderTemplateInput) {
  const normalized = normalizeOrderTemplateInput(input);
  const actorId = normalizeIdentifier(input.actorId, "TEMPLATE_ACTOR_REQUIRED");

  try {
    return await runSerializableTransaction(db, async (tx) => {
      await assertActiveAllergens(tx, normalized.items);

      const template = await tx.orderTemplate.create({
        data: {
          name: normalized.name,
          nameKey: normalized.nameKey,
          description: normalized.description,
          sortOrder: normalized.sortOrder,
          createdBy: actorId,
          updatedBy: actorId,
          items: {
            create: normalized.items.map((item) => ({
              allergenId: item.allergenId,
              quantity: item.quantity,
              position: item.position
            }))
          }
        },
        select: {
          id: true
        }
      });

      await tx.auditLog.create({
        data: {
          action: "ORDER_TEMPLATE_CREATE",
          entityType: "ORDER_TEMPLATE",
          entityId: template.id,
          description: `주문 세트 ${normalized.name} 등록`,
          actorId
        }
      });

      return returnWrittenTemplate(tx, template.id);
    });
  } catch (error) {
    mapTemplateWriteError(error);
  }
}

export async function updateOrderTemplate(db: PrismaClient, input: UpdateOrderTemplateInput) {
  const id = normalizeIdentifier(input.id, "TEMPLATE_ID_REQUIRED");
  const actorId = normalizeIdentifier(input.actorId, "TEMPLATE_ACTOR_REQUIRED");
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  const { name, nameKey } = normalizeOrderTemplateName(input.name);
  const description = normalizeOrderTemplateDescription(input.description);
  const items = normalizeOrderTemplateItems(input.items);

  try {
    return await runSerializableTransaction(db, async (tx) => {
      const existing = await findTemplateOrThrow(tx, id);

      if (existing.version !== expectedVersion) {
        throw new Error("TEMPLATE_VERSION_CONFLICT");
      }

      await assertActiveAllergens(tx, items);

      const claim = await tx.orderTemplate.updateMany({
        where: {
          id,
          version: expectedVersion
        },
        data: {
          name,
          nameKey,
          description,
          sortOrder:
            input.sortOrder === undefined
              ? existing.sortOrder
              : normalizeOrderTemplateSortOrder(input.sortOrder),
          updatedBy: actorId,
          version: {
            increment: 1
          }
        }
      });

      if (claim.count !== 1) {
        throw new Error("TEMPLATE_VERSION_CONFLICT");
      }

      await tx.orderTemplateItem.deleteMany({
        where: {
          templateId: id
        }
      });
      await tx.orderTemplateItem.createMany({
        data: items.map((item) => ({
          templateId: id,
          allergenId: item.allergenId,
          quantity: item.quantity,
          position: item.position
        }))
      });

      await tx.auditLog.create({
        data: {
          action: "ORDER_TEMPLATE_UPDATE",
          entityType: "ORDER_TEMPLATE",
          entityId: id,
          description: `주문 세트 ${name} 수정`,
          actorId
        }
      });

      return returnWrittenTemplate(tx, id);
    });
  } catch (error) {
    mapTemplateWriteError(error);
  }
}

export async function setOrderTemplateActive(
  db: PrismaClient,
  input: SetOrderTemplateActiveInput
) {
  const id = normalizeIdentifier(input.id, "TEMPLATE_ID_REQUIRED");
  const actorId = normalizeIdentifier(input.actorId, "TEMPLATE_ACTOR_REQUIRED");
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);

  return runSerializableTransaction(db, async (tx) => {
    const template = await findTemplateOrThrow(tx, id);

    if (template.version !== expectedVersion) {
      throw new Error("TEMPLATE_VERSION_CONFLICT");
    }

    if (input.isActive) {
      await assertActiveAllergens(tx, template.items);
    }

    const claim = await tx.orderTemplate.updateMany({
      where: {
        id,
        version: expectedVersion
      },
      data: {
        isActive: input.isActive,
        updatedBy: actorId,
        version: {
          increment: 1
        }
      }
    });

    if (claim.count !== 1) {
      throw new Error("TEMPLATE_VERSION_CONFLICT");
    }

    await tx.auditLog.create({
      data: {
        action: input.isActive ? "ORDER_TEMPLATE_ACTIVATE" : "ORDER_TEMPLATE_DEACTIVATE",
        entityType: "ORDER_TEMPLATE",
        entityId: id,
        description: `주문 세트 ${template.name} ${input.isActive ? "활성화" : "비활성화"}`,
        actorId
      }
    });

    return returnWrittenTemplate(tx, id);
  });
}
