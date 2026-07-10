export type RawOrderItemInput = {
  allergenId: string;
  quantity: string;
};

export type NormalizedOrderItemInput = {
  allergenId: string;
  quantity: number;
};

export function normalizeOrderItems(items: RawOrderItemInput[]) {
  const merged = new Map<string, number>();

  for (const item of items) {
    const allergenId = item.allergenId.trim();
    const quantity = Number.parseInt(item.quantity.trim(), 10);

    if (!allergenId) {
      throw new Error("ORDER_ITEM_ALLERGEN_REQUIRED");
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("ORDER_ITEM_QUANTITY_INVALID");
    }

    merged.set(allergenId, (merged.get(allergenId) ?? 0) + quantity);
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
