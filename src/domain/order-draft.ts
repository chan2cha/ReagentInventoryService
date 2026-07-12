export type OrderDraftRowSource = "MANUAL" | "TEMPLATE";

export type OrderDraftRow = {
  rowId: number;
  allergenId: string;
  quantity: string;
  /** Missing on legacy rows, which are treated as manually entered rows. */
  source?: OrderDraftRowSource;
  /** Present only while the row belongs to the currently selected template. */
  templateId?: string;
  /** Keeps a row when a template is changed because the row existed manually first. */
  hasManualOrigin?: boolean;
};

export type OrderTemplateDraftItem = {
  allergenId: string;
  quantity: number;
};

export type OrderTemplateDraftState = "exact" | "modified";

type NormalizedTemplateItem = {
  allergenId: string;
  quantity: string;
};

const POSTGRES_INTEGER_MAX = 2_147_483_647;

function normalizeTemplateId(templateId: string) {
  const normalized = templateId.trim();

  if (!normalized) {
    throw new Error("ORDER_TEMPLATE_ID_REQUIRED");
  }

  return normalized;
}

function normalizeTemplateItems(items: OrderTemplateDraftItem[]): NormalizedTemplateItem[] {
  if (items.length === 0) {
    throw new Error("ORDER_TEMPLATE_ITEM_REQUIRED");
  }

  const allergenIds = new Set<string>();

  return items.map((item) => {
    const allergenId = item.allergenId.trim();

    if (!allergenId || allergenIds.has(allergenId)) {
      throw new Error("ORDER_TEMPLATE_ITEM_INVALID");
    }

    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > POSTGRES_INTEGER_MAX) {
      throw new Error("ORDER_TEMPLATE_ITEM_INVALID");
    }

    allergenIds.add(allergenId);
    return { allergenId, quantity: String(item.quantity) };
  });
}

function toManualRow(row: OrderDraftRow): OrderDraftRow {
  const { source: _source, templateId: _templateId, hasManualOrigin: _hasManualOrigin, ...draftRow } = row;
  return { ...draftRow, source: "MANUAL" };
}

function isManualOrigin(row: OrderDraftRow) {
  return row.source !== "TEMPLATE" || row.hasManualOrigin === true;
}

function isCompletelyEmpty(row: OrderDraftRow) {
  return !row.allergenId.trim() && !row.quantity.trim();
}

function normalizeRowAllergen(row: OrderDraftRow): OrderDraftRow {
  return { ...row, allergenId: row.allergenId.trim() };
}

/**
 * Invalid duplicate draft rows are folded into one stable row. A manually
 * entered value wins over a template-only value so changing templates never
 * silently discards user input.
 */
function deduplicateRows(rows: OrderDraftRow[]) {
  const deduplicated: OrderDraftRow[] = [];
  const indexes = new Map<string, number>();

  for (const row of rows) {
    if (!row.allergenId) {
      deduplicated.push(row);
      continue;
    }

    const existingIndex = indexes.get(row.allergenId);

    if (existingIndex === undefined) {
      indexes.set(row.allergenId, deduplicated.length);
      deduplicated.push(row);
      continue;
    }

    const existing = deduplicated[existingIndex];
    const existingIsManual = isManualOrigin(existing);
    const rowIsManual = isManualOrigin(row);
    const templateRow = existing.source === "TEMPLATE"
      ? existing
      : row.source === "TEMPLATE"
        ? row
        : undefined;
    const manualRow = existingIsManual && existing.source !== "TEMPLATE"
      ? existing
      : rowIsManual && row.source !== "TEMPLATE"
        ? row
        : undefined;

    if (!templateRow) {
      continue;
    }

    deduplicated[existingIndex] = {
      ...existing,
      quantity: manualRow?.quantity ?? templateRow.quantity,
      source: "TEMPLATE",
      templateId: templateRow.templateId,
      ...(existingIsManual || rowIsManual ? { hasManualOrigin: true } : {})
    };
  }

  return deduplicated;
}

function prepareRowsForTemplate(
  rows: OrderDraftRow[],
  templateId: string,
  templateItems: NormalizedTemplateItem[]
) {
  const templateAllergenIds = new Set(templateItems.map((item) => item.allergenId));
  const preparedRows: OrderDraftRow[] = [];

  for (const originalRow of rows) {
    if (isCompletelyEmpty(originalRow)) {
      continue;
    }

    const row = normalizeRowAllergen(originalRow);

    if (row.source !== "TEMPLATE") {
      preparedRows.push(toManualRow(row));
      continue;
    }

    const rowTemplateId = row.templateId?.trim();
    const stillBelongsToTarget = rowTemplateId === templateId && templateAllergenIds.has(row.allergenId);

    if (stillBelongsToTarget) {
      preparedRows.push({ ...row, templateId });
    } else if (row.hasManualOrigin) {
      preparedRows.push(toManualRow(row));
    }
  }

  return deduplicateRows(preparedRows);
}

function applyNormalizedTemplate(
  rows: OrderDraftRow[],
  templateId: string,
  templateItems: NormalizedTemplateItem[],
  nextRowId: () => number,
  restoreDefaults: boolean
) {
  const mergedRows = prepareRowsForTemplate(rows, templateId, templateItems);
  const rowIndexes = new Map<string, number>();

  mergedRows.forEach((row, index) => {
    if (row.allergenId) rowIndexes.set(row.allergenId, index);
  });

  for (const item of templateItems) {
    const existingIndex = rowIndexes.get(item.allergenId);

    if (existingIndex === undefined) {
      rowIndexes.set(item.allergenId, mergedRows.length);
      mergedRows.push({
        rowId: nextRowId(),
        allergenId: item.allergenId,
        quantity: item.quantity,
        source: "TEMPLATE",
        templateId
      });
      continue;
    }

    const existing = mergedRows[existingIndex];
    const hasManualOrigin = isManualOrigin(existing);
    mergedRows[existingIndex] = {
      ...existing,
      quantity: restoreDefaults ? item.quantity : existing.quantity,
      source: "TEMPLATE",
      templateId,
      ...(hasManualOrigin ? { hasManualOrigin: true } : {})
    };
  }

  return mergedRows;
}

/**
 * Selects the single template used as the basis of an order.
 *
 * Template-only rows from a previous selection are removed. Manual rows and
 * rows with a manual origin survive. If a selected item already exists
 * manually, its quantity is deliberately retained; the template is therefore
 * reported as modified until the user explicitly restores its defaults.
 */
export function selectOrderTemplateInDraft(
  rows: OrderDraftRow[],
  templateId: string,
  templateItems: OrderTemplateDraftItem[],
  nextRowId: () => number
) {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  const normalizedItems = normalizeTemplateItems(templateItems);
  return applyNormalizedTemplate(rows, normalizedTemplateId, normalizedItems, nextRowId, false);
}

/** Restores all items of the selected template to their configured defaults. */
export function reapplyOrderTemplateToDraft(
  rows: OrderDraftRow[],
  templateId: string,
  templateItems: OrderTemplateDraftItem[],
  nextRowId: () => number
) {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  const normalizedItems = normalizeTemplateItems(templateItems);
  return applyNormalizedTemplate(rows, normalizedTemplateId, normalizedItems, nextRowId, true);
}

/** Keeps every draft row but removes its association with the selected template. */
export function detachOrderTemplateFromDraft(rows: OrderDraftRow[]) {
  return rows.map(toManualRow);
}

function parseDraftQuantity(quantity: string) {
  const normalized = quantity.trim();

  if (!/^[1-9]\d*$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= POSTGRES_INTEGER_MAX
    ? parsed
    : null;
}

/**
 * Compares only the selected template's configured items. Unrelated manual
 * additions do not modify the template; missing, duplicate, or quantity-edited
 * configured items do.
 */
export function getOrderTemplateDraftState(
  rows: readonly OrderDraftRow[],
  templateId: string,
  templateItems: OrderTemplateDraftItem[]
): OrderTemplateDraftState {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  const normalizedItems = normalizeTemplateItems(templateItems);
  const expectedAllergenIds = new Set(normalizedItems.map((item) => item.allergenId));
  const rowsByAllergen = new Map<string, OrderDraftRow[]>();

  for (const row of rows) {
    const allergenId = row.allergenId.trim();
    if (!allergenId) continue;
    const matchingRows = rowsByAllergen.get(allergenId) ?? [];
    matchingRows.push(row);
    rowsByAllergen.set(allergenId, matchingRows);

    if (
      row.source === "TEMPLATE" &&
      row.templateId?.trim() === normalizedTemplateId &&
      !expectedAllergenIds.has(allergenId)
    ) {
      return "modified";
    }
  }

  for (const item of normalizedItems) {
    const matchingRows = rowsByAllergen.get(item.allergenId);

    if (matchingRows?.length !== 1 || parseDraftQuantity(matchingRows[0].quantity) !== Number(item.quantity)) {
      return "modified";
    }
  }

  return "exact";
}

/** Changing a row's allergen makes that row a manual edit. */
export function changeOrderDraftRowAllergen(
  rows: OrderDraftRow[],
  rowId: number,
  allergenId: string
) {
  return rows.map((row) => {
    if (row.rowId !== rowId || row.allergenId === allergenId) return row;
    return { ...toManualRow(row), allergenId };
  });
}

/** Quantity edits retain provenance so the selected template can be restored. */
export function changeOrderDraftRowQuantity(
  rows: OrderDraftRow[],
  rowId: number,
  quantity: string
) {
  return rows.map((row) => row.rowId === rowId ? { ...row, quantity } : row);
}
