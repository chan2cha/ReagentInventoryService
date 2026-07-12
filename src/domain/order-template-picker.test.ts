import { describe, expect, it } from "vitest";
import {
  matchesOrderTemplateQuery,
  type OrderTemplateSearchCandidate
} from "./order-template-picker";

const template: OrderTemplateSearchCandidate = {
  name: "정기 Regular 세트",
  description: "Monthly routine order",
  items: [
    {
      allergen: {
        code: "EGG-01",
        name: "난백 Egg White"
      }
    },
    {
      allergen: {
        code: "MILK-02",
        name: "우유 단백질"
      }
    }
  ]
};

describe("matchesOrderTemplateQuery", () => {
  it("matches an empty query", () => {
    expect(matchesOrderTemplateQuery(template, "")).toBe(true);
    expect(matchesOrderTemplateQuery(template, " \n\t ")).toBe(true);
  });

  it("normalizes compatibility characters, surrounding whitespace, and case", () => {
    expect(matchesOrderTemplateQuery(template, "  ｒＥＧＵＬＡＲ  ")).toBe(true);
  });

  it("matches the description without case sensitivity", () => {
    expect(matchesOrderTemplateQuery(template, " ROUTINE ")).toBe(true);
  });

  it("matches allergen codes and names", () => {
    expect(matchesOrderTemplateQuery(template, " ｅｇｇ－０１ ")).toBe(true);
    expect(matchesOrderTemplateQuery(template, "우유 단백")).toBe(true);
  });

  it("normalizes searchable candidate text and handles a missing description", () => {
    const candidate = {
      name: "Ａ 세트",
      description: null,
      items: [{ allergen: { code: "ＭＩＬＫ", name: "우유" } }]
    };

    expect(matchesOrderTemplateQuery(candidate, "a 세트")).toBe(true);
    expect(matchesOrderTemplateQuery(candidate, "milk")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesOrderTemplateQuery(template, "대두")).toBe(false);
  });
});
