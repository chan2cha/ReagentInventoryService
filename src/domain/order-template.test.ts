import { describe, expect, it } from "vitest";
import {
  ORDER_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  ORDER_TEMPLATE_ITEM_MAX_COUNT,
  ORDER_TEMPLATE_NAME_MAX_LENGTH,
  normalizeOrderTemplateDescription,
  normalizeOrderTemplateInput,
  normalizeOrderTemplateItems,
  normalizeOrderTemplateName,
  normalizeOrderTemplateSortOrder
} from "./order-template";

describe("normalizeOrderTemplateName", () => {
  it("normalizes compatibility characters and whitespace for display and uniqueness", () => {
    expect(normalizeOrderTemplateName("  Ａ세트\n\t 기본  ")).toEqual({
      name: "A세트 기본",
      nameKey: "a세트 기본"
    });
  });

  it("rejects blank and overlong names", () => {
    expect(() => normalizeOrderTemplateName(" \n ")).toThrow("TEMPLATE_NAME_REQUIRED");
    expect(() => normalizeOrderTemplateName("가".repeat(ORDER_TEMPLATE_NAME_MAX_LENGTH + 1))).toThrow(
      "TEMPLATE_NAME_TOO_LONG"
    );
    expect(() => normalizeOrderTemplateName("İ".repeat(ORDER_TEMPLATE_NAME_MAX_LENGTH))).toThrow(
      "TEMPLATE_NAME_TOO_LONG"
    );
  });
});

describe("normalizeOrderTemplateDescription", () => {
  it("converts a blank description to null", () => {
    expect(normalizeOrderTemplateDescription("   ")).toBeNull();
  });

  it("rejects an overlong description", () => {
    expect(() => normalizeOrderTemplateDescription("가".repeat(ORDER_TEMPLATE_DESCRIPTION_MAX_LENGTH + 1))).toThrow(
      "TEMPLATE_DESCRIPTION_TOO_LONG"
    );
  });
});

describe("normalizeOrderTemplateItems", () => {
  it("trims allergen ids, parses canonical positive integers, and assigns stable positions", () => {
    expect(
      normalizeOrderTemplateItems([
        { allergenId: " EGG ", quantity: "2" },
        { allergenId: "MILK", quantity: 3 }
      ])
    ).toEqual([
      { allergenId: "EGG", quantity: 2, position: 0 },
      { allergenId: "MILK", quantity: 3, position: 1 }
    ]);
  });

  it("rejects an empty set, blank ids, and duplicate allergens", () => {
    expect(() => normalizeOrderTemplateItems([])).toThrow("TEMPLATE_ITEM_REQUIRED");
    expect(() => normalizeOrderTemplateItems([{ allergenId: " ", quantity: 1 }])).toThrow(
      "TEMPLATE_ITEM_ALLERGEN_REQUIRED"
    );
    expect(() =>
      normalizeOrderTemplateItems([
        { allergenId: "EGG", quantity: 1 },
        { allergenId: " EGG ", quantity: 2 }
      ])
    ).toThrow("TEMPLATE_ITEM_ALLERGEN_DUPLICATE");
  });

  it.each(["0", "01", "1.5", "1abc", -1, 2_147_483_648, Number.NaN])(
    "rejects a non-canonical or out-of-range quantity: %s",
    (quantity) => {
      expect(() => normalizeOrderTemplateItems([{ allergenId: "EGG", quantity }])).toThrow(
        "TEMPLATE_ITEM_QUANTITY_INVALID"
      );
    }
  );

  it("limits the number of items", () => {
    expect(() =>
      normalizeOrderTemplateItems(
        Array.from({ length: ORDER_TEMPLATE_ITEM_MAX_COUNT + 1 }, (_, index) => ({
          allergenId: `allergen-${index}`,
          quantity: 1
        }))
      )
    ).toThrow("TEMPLATE_ITEM_LIMIT_EXCEEDED");
  });
});

describe("normalizeOrderTemplateInput", () => {
  it("normalizes all persisted fields", () => {
    expect(
      normalizeOrderTemplateInput({
        name: "  정기  세트 ",
        description: "  설명 ",
        sortOrder: "2",
        items: [{ allergenId: "EGG", quantity: "4" }]
      })
    ).toEqual({
      name: "정기 세트",
      nameKey: "정기 세트",
      description: "설명",
      sortOrder: 2,
      items: [{ allergenId: "EGG", quantity: 4, position: 0 }]
    });
  });

  it.each(["-1", "01", "1.2", 2_147_483_648])("rejects an invalid sort order: %s", (sortOrder) => {
    expect(() => normalizeOrderTemplateSortOrder(sortOrder)).toThrow("TEMPLATE_SORT_ORDER_INVALID");
  });
});
