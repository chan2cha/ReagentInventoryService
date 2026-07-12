import { describe, expect, it } from "vitest";
import {
  changeOrderDraftRowAllergen,
  changeOrderDraftRowQuantity,
  detachOrderTemplateFromDraft,
  getOrderTemplateDraftState,
  reapplyOrderTemplateToDraft,
  selectOrderTemplateInDraft,
  type OrderDraftRow
} from "./order-draft";

function idFactory(start = 10) {
  let nextId = start;
  return () => nextId++;
}

describe("single selected order template", () => {
  const templateA = [
    { allergenId: "EGG", quantity: 2 },
    { allergenId: "MILK", quantity: 3 }
  ];

  it("rejects empty, duplicate, blank, or invalid template items", () => {
    expect(() => selectOrderTemplateInDraft([], "template-a", [], idFactory())).toThrow(
      "ORDER_TEMPLATE_ITEM_REQUIRED"
    );
    expect(() => selectOrderTemplateInDraft([], "template-a", [
      { allergenId: "EGG", quantity: 1 },
      { allergenId: " EGG ", quantity: 2 }
    ], idFactory())).toThrow("ORDER_TEMPLATE_ITEM_INVALID");
    expect(() => selectOrderTemplateInDraft(
      [],
      "template-a",
      [{ allergenId: "", quantity: 1 }],
      idFactory()
    )).toThrow("ORDER_TEMPLATE_ITEM_INVALID");
    expect(() => selectOrderTemplateInDraft(
      [],
      "template-a",
      [{ allergenId: "EGG", quantity: 1.5 }],
      idFactory()
    )).toThrow("ORDER_TEMPLATE_ITEM_INVALID");
    expect(() => selectOrderTemplateInDraft(
      [],
      "template-a",
      [{ allergenId: "EGG", quantity: 2_147_483_648 }],
      idFactory()
    )).toThrow("ORDER_TEMPLATE_ITEM_INVALID");
  });

  it("restores the same selected template idempotently without duplicating rows", () => {
    const createRowId = idFactory();
    const selected = selectOrderTemplateInDraft([], "template-a", templateA, createRowId);
    const firstRestore = reapplyOrderTemplateToDraft(
      selected,
      "template-a",
      templateA,
      createRowId
    );
    const secondRestore = reapplyOrderTemplateToDraft(
      firstRestore,
      "template-a",
      templateA,
      createRowId
    );

    expect(secondRestore).toEqual(firstRestore);
    expect(secondRestore).toHaveLength(2);
  });

  it("preserves a matching manual quantity and records both origins on first selection", () => {
    const selected = selectOrderTemplateInDraft(
      [
        { rowId: 1, allergenId: "MANUAL", quantity: "7" },
        { rowId: 2, allergenId: " EGG ", quantity: "99" },
        { rowId: 3, allergenId: "", quantity: "" }
      ],
      " template-a ",
      templateA,
      idFactory()
    );

    expect(selected).toEqual([
      { rowId: 1, allergenId: "MANUAL", quantity: "7", source: "MANUAL" },
      {
        rowId: 2,
        allergenId: "EGG",
        quantity: "99",
        source: "TEMPLATE",
        templateId: "template-a",
        hasManualOrigin: true
      },
      { rowId: 10, allergenId: "MILK", quantity: "3", source: "TEMPLATE", templateId: "template-a" }
    ]);
    expect(getOrderTemplateDraftState(selected, "template-a", templateA)).toBe("modified");
  });

  it("restores defaults only on explicit reapplication and keeps unrelated manual rows", () => {
    const createRowId = idFactory();
    const selected = selectOrderTemplateInDraft(
      [
        { rowId: 1, allergenId: "MANUAL", quantity: "7" },
        { rowId: 2, allergenId: "EGG", quantity: "99" }
      ],
      "template-a",
      templateA,
      createRowId
    );
    const restored = reapplyOrderTemplateToDraft(
      selected,
      "template-a",
      templateA,
      createRowId
    );

    expect(restored).toEqual([
      { rowId: 1, allergenId: "MANUAL", quantity: "7", source: "MANUAL" },
      {
        rowId: 2,
        allergenId: "EGG",
        quantity: "2",
        source: "TEMPLATE",
        templateId: "template-a",
        hasManualOrigin: true
      },
      { rowId: 10, allergenId: "MILK", quantity: "3", source: "TEMPLATE", templateId: "template-a" }
    ]);
    expect(getOrderTemplateDraftState(restored, "template-a", templateA)).toBe("exact");
  });

  it("removes old template-only rows, preserves manual-origin rows, and creates no duplicates on change", () => {
    const createRowId = idFactory();
    const first = selectOrderTemplateInDraft(
      [
        { rowId: 1, allergenId: "EGG", quantity: "9" },
        { rowId: 2, allergenId: "MANUAL", quantity: "7" }
      ],
      "template-a",
      templateA,
      createRowId
    );
    const changed = selectOrderTemplateInDraft(
      first,
      "template-b",
      [
        { allergenId: "EGG", quantity: 5 },
        { allergenId: "MILK", quantity: 6 },
        { allergenId: "SOY", quantity: 4 }
      ],
      createRowId
    );

    expect(changed).toEqual([
      {
        rowId: 1,
        allergenId: "EGG",
        quantity: "9",
        source: "TEMPLATE",
        templateId: "template-b",
        hasManualOrigin: true
      },
      { rowId: 2, allergenId: "MANUAL", quantity: "7", source: "MANUAL" },
      { rowId: 11, allergenId: "MILK", quantity: "6", source: "TEMPLATE", templateId: "template-b" },
      { rowId: 12, allergenId: "SOY", quantity: "4", source: "TEMPLATE", templateId: "template-b" }
    ]);
    expect(changed.map((row) => row.allergenId)).toEqual(["EGG", "MANUAL", "MILK", "SOY"]);
    expect(getOrderTemplateDraftState(changed, "template-b", [
      { allergenId: "EGG", quantity: 5 },
      { allergenId: "MILK", quantity: 6 },
      { allergenId: "SOY", quantity: 4 }
    ])).toBe("modified");
  });

  it("keeps partially entered manual rows while dropping only completely empty placeholders", () => {
    const selected = selectOrderTemplateInDraft(
      [
        { rowId: 1, allergenId: " ", quantity: "4" },
        { rowId: 2, allergenId: "", quantity: "   " }
      ],
      "template-a",
      [{ allergenId: "EGG", quantity: 2 }],
      idFactory()
    );

    expect(selected).toEqual([
      { rowId: 1, allergenId: "", quantity: "4", source: "MANUAL" },
      { rowId: 10, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" }
    ]);
  });

  it("detaches a template without deleting or changing item values", () => {
    const rows: OrderDraftRow[] = [
      { rowId: 1, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" },
      {
        rowId: 2,
        allergenId: "MILK",
        quantity: "8",
        source: "TEMPLATE",
        templateId: "template-a",
        hasManualOrigin: true
      },
      { rowId: 3, allergenId: "SOY", quantity: "1", source: "MANUAL" }
    ];

    expect(detachOrderTemplateFromDraft(rows)).toEqual([
      { rowId: 1, allergenId: "EGG", quantity: "2", source: "MANUAL" },
      { rowId: 2, allergenId: "MILK", quantity: "8", source: "MANUAL" },
      { rowId: 3, allergenId: "SOY", quantity: "1", source: "MANUAL" }
    ]);
  });

  it("turns an allergen edit into a manual row but retains provenance for a quantity edit", () => {
    const selected = selectOrderTemplateInDraft(
      [],
      "template-a",
      [{ allergenId: "EGG", quantity: 2 }],
      idFactory()
    );
    const quantityEdited = changeOrderDraftRowQuantity(selected, 10, "7");
    const allergenEdited = changeOrderDraftRowAllergen(selected, 10, "SOY");

    expect(quantityEdited).toEqual([
      { rowId: 10, allergenId: "EGG", quantity: "7", source: "TEMPLATE", templateId: "template-a" }
    ]);
    expect(getOrderTemplateDraftState(quantityEdited, "template-a", [{ allergenId: "EGG", quantity: 2 }])).toBe(
      "modified"
    );
    expect(allergenEdited).toEqual([
      { rowId: 10, allergenId: "SOY", quantity: "2", source: "MANUAL" }
    ]);
    expect(getOrderTemplateDraftState(allergenEdited, "template-a", [{ allergenId: "EGG", quantity: 2 }])).toBe(
      "modified"
    );
  });

  it("restores removed and replaced template items without deleting the replacement manual row", () => {
    const createRowId = idFactory();
    const selected = selectOrderTemplateInDraft([], "template-a", templateA, createRowId);
    const edited = changeOrderDraftRowAllergen(
      selected.filter((row) => row.allergenId !== "EGG"),
      11,
      "SOY"
    );
    const restored = reapplyOrderTemplateToDraft(
      edited,
      "template-a",
      templateA,
      createRowId
    );

    expect(restored).toEqual([
      { rowId: 11, allergenId: "SOY", quantity: "3", source: "MANUAL" },
      { rowId: 12, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" },
      { rowId: 13, allergenId: "MILK", quantity: "3", source: "TEMPLATE", templateId: "template-a" }
    ]);
    expect(getOrderTemplateDraftState(restored, "template-a", templateA)).toBe("exact");
  });

  it("ignores manual additions but treats a non-canonical configured quantity as modified", () => {
    expect(getOrderTemplateDraftState([
      { rowId: 1, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" },
      { rowId: 2, allergenId: "SOY", quantity: "9", source: "MANUAL" }
    ], "template-a", [{ allergenId: "EGG", quantity: 2 }])).toBe("exact");
    expect(getOrderTemplateDraftState([
      { rowId: 1, allergenId: "EGG", quantity: "02", source: "TEMPLATE", templateId: "template-a" }
    ], "template-a", [{ allergenId: "EGG", quantity: 2 }])).toBe("modified");
  });

  it("keeps every detached item as manual when a different template is selected later", () => {
    const createRowId = idFactory();
    const selected = selectOrderTemplateInDraft(
      [{ rowId: 1, allergenId: "SOY", quantity: "7", source: "MANUAL" }],
      "template-a",
      [{ allergenId: "EGG", quantity: 2 }],
      createRowId
    );
    const detached = detachOrderTemplateFromDraft(selected);
    const changed = selectOrderTemplateInDraft(
      detached,
      "template-b",
      [{ allergenId: "MILK", quantity: 5 }],
      createRowId
    );

    expect(changed).toEqual([
      { rowId: 1, allergenId: "SOY", quantity: "7", source: "MANUAL" },
      { rowId: 10, allergenId: "EGG", quantity: "2", source: "MANUAL" },
      { rowId: 11, allergenId: "MILK", quantity: "5", source: "TEMPLATE", templateId: "template-b" }
    ]);
  });

  it("treats missing, duplicate, stale, and out-of-range configured rows as modified", () => {
    const template = [{ allergenId: "EGG", quantity: 2 }];

    expect(getOrderTemplateDraftState([], "template-a", template)).toBe("modified");
    expect(getOrderTemplateDraftState([
      { rowId: 1, allergenId: "EGG", quantity: "2" },
      { rowId: 2, allergenId: "EGG", quantity: "2" }
    ], "template-a", template)).toBe("modified");
    expect(getOrderTemplateDraftState([
      { rowId: 1, allergenId: "EGG", quantity: "2147483648" }
    ], "template-a", template)).toBe("modified");
    expect(getOrderTemplateDraftState([
      { rowId: 1, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" },
      { rowId: 2, allergenId: "STALE", quantity: "1", source: "TEMPLATE", templateId: "template-a" }
    ], "template-a", template)).toBe("modified");
  });

  it("folds duplicate draft allergens without losing a manual value", () => {
    const selected = selectOrderTemplateInDraft(
      [
        { rowId: 1, allergenId: "EGG", quantity: "2", source: "TEMPLATE", templateId: "template-a" },
        { rowId: 2, allergenId: "EGG", quantity: "8", source: "MANUAL" }
      ],
      "template-a",
      [{ allergenId: "EGG", quantity: 2 }],
      idFactory()
    );

    expect(selected).toEqual([
      {
        rowId: 1,
        allergenId: "EGG",
        quantity: "8",
        source: "TEMPLATE",
        templateId: "template-a",
        hasManualOrigin: true
      }
    ]);
  });

  it("validates the template id and accepts the PostgreSQL integer maximum", () => {
    expect(() => selectOrderTemplateInDraft([], " ", templateA, idFactory())).toThrow(
      "ORDER_TEMPLATE_ID_REQUIRED"
    );
    expect(selectOrderTemplateInDraft(
      [],
      "template-a",
      [{ allergenId: "EGG", quantity: 2_147_483_647 }],
      idFactory()
    )).toEqual([
      {
        rowId: 10,
        allergenId: "EGG",
        quantity: "2147483647",
        source: "TEMPLATE",
        templateId: "template-a"
      }
    ]);
  });
});
