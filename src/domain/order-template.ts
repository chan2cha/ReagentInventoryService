const POSTGRES_INTEGER_MAX = 2_147_483_647;

export const ORDER_TEMPLATE_NAME_MAX_LENGTH = 100;
export const ORDER_TEMPLATE_DESCRIPTION_MAX_LENGTH = 500;
export const ORDER_TEMPLATE_ITEM_MAX_COUNT = 100;

export type RawOrderTemplateItemInput = {
  allergenId: string;
  quantity: string | number;
};

export type NormalizedOrderTemplateItemInput = {
  allergenId: string;
  quantity: number;
  position: number;
};

export type RawOrderTemplateInput = {
  name: string;
  description?: string | null;
  sortOrder?: string | number;
  items: RawOrderTemplateItemInput[];
};

export type NormalizedOrderTemplateInput = {
  name: string;
  nameKey: string;
  description: string | null;
  sortOrder: number;
  items: NormalizedOrderTemplateItemInput[];
};

function characterLength(value: string) {
  return Array.from(value).length;
}

function parseInteger(value: string | number, allowZero: boolean, errorCode: string) {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else {
    const trimmed = value.trim();
    const pattern = allowZero ? /^(?:0|[1-9]\d*)$/ : /^[1-9]\d*$/;

    if (!pattern.test(trimmed)) {
      throw new Error(errorCode);
    }

    parsed = Number(trimmed);
  }

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > POSTGRES_INTEGER_MAX ||
    (allowZero ? parsed < 0 : parsed < 1)
  ) {
    throw new Error(errorCode);
  }

  return parsed;
}

export function normalizeOrderTemplateName(value: string) {
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");

  if (!name) {
    throw new Error("TEMPLATE_NAME_REQUIRED");
  }

  if (characterLength(name) > ORDER_TEMPLATE_NAME_MAX_LENGTH) {
    throw new Error("TEMPLATE_NAME_TOO_LONG");
  }

  const nameKey = name.toLowerCase();

  // Some Unicode lowercase mappings expand to multiple code points (for
  // example, U+0130). Keep the derived key inside the database constraint too.
  if (characterLength(nameKey) > ORDER_TEMPLATE_NAME_MAX_LENGTH) {
    throw new Error("TEMPLATE_NAME_TOO_LONG");
  }

  return { name, nameKey };
}

export function normalizeOrderTemplateDescription(value?: string | null) {
  const description = value?.normalize("NFKC").trim() ?? "";

  if (characterLength(description) > ORDER_TEMPLATE_DESCRIPTION_MAX_LENGTH) {
    throw new Error("TEMPLATE_DESCRIPTION_TOO_LONG");
  }

  return description || null;
}

export function normalizeOrderTemplateSortOrder(value: string | number = 0) {
  return parseInteger(value, true, "TEMPLATE_SORT_ORDER_INVALID");
}

export function normalizeOrderTemplateItems(items: RawOrderTemplateItemInput[]) {
  if (items.length < 1) {
    throw new Error("TEMPLATE_ITEM_REQUIRED");
  }

  if (items.length > ORDER_TEMPLATE_ITEM_MAX_COUNT) {
    throw new Error("TEMPLATE_ITEM_LIMIT_EXCEEDED");
  }

  const seenAllergenIds = new Set<string>();

  return items.map((item, position): NormalizedOrderTemplateItemInput => {
    const allergenId = item.allergenId.trim();

    if (!allergenId) {
      throw new Error("TEMPLATE_ITEM_ALLERGEN_REQUIRED");
    }

    if (seenAllergenIds.has(allergenId)) {
      throw new Error("TEMPLATE_ITEM_ALLERGEN_DUPLICATE");
    }

    seenAllergenIds.add(allergenId);

    return {
      allergenId,
      quantity: parseInteger(item.quantity, false, "TEMPLATE_ITEM_QUANTITY_INVALID"),
      position
    };
  });
}

export function normalizeOrderTemplateInput(input: RawOrderTemplateInput): NormalizedOrderTemplateInput {
  const { name, nameKey } = normalizeOrderTemplateName(input.name);

  return {
    name,
    nameKey,
    description: normalizeOrderTemplateDescription(input.description),
    sortOrder: normalizeOrderTemplateSortOrder(input.sortOrder),
    items: normalizeOrderTemplateItems(input.items)
  };
}
