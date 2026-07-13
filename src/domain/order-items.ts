export type RawOrderItemInput = {
  allergenId: string;
  quantity: string;
};

/** 주문 입력을 DB 쓰기 전에 정규화하고 중복 품목을 하나의 수량으로 합친다. */

export type NormalizedOrderItemInput = {
  allergenId: string;
  quantity: number;
};

const POSTGRES_INTEGER_MAX = 2_147_483_647;

function positiveOrderQuantity(value: string) {
  const normalized = value.trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("ORDER_ITEM_QUANTITY_INVALID");
  }

  const quantity = Number(normalized);

  if (!Number.isSafeInteger(quantity) || quantity > POSTGRES_INTEGER_MAX) {
    throw new Error("ORDER_ITEM_QUANTITY_INVALID");
  }

  return quantity;
}

export function normalizeOrderItems(items: RawOrderItemInput[]) {
  const merged = new Map<string, number>();

  for (const item of items) {
    const allergenId = item.allergenId.trim();

    if (!allergenId) {
      throw new Error("ORDER_ITEM_ALLERGEN_REQUIRED");
    }

    const quantity = positiveOrderQuantity(item.quantity);
    const mergedQuantity = (merged.get(allergenId) ?? 0) + quantity;

    if (mergedQuantity > POSTGRES_INTEGER_MAX) {
      throw new Error("ORDER_ITEM_QUANTITY_INVALID");
    }

    merged.set(allergenId, mergedQuantity);
  }

  const normalized = Array.from(merged.entries()).map(([allergenId, quantity]) => ({
    allergenId,
    quantity
  }));

  if (normalized.length < 1) {
    throw new Error("ORDER_ITEM_REQUIRED");
  }

  return normalized;
}
