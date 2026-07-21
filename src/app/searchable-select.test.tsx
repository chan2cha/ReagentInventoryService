import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  filterSearchableOptions,
  normalizeSearchText,
  SearchableSelect,
  type SearchableSelectOption
} from "./searchable-select";

const options: SearchableSelectOption[] = [
  {
    id: "client-1",
    label: "가나다 연구소",
    description: "담당 김철수 · 02-1234-5678",
    keywords: ["서울"]
  },
  {
    id: "client-2",
    label: "ACME Lab",
    description: "담당 Jane",
    keywords: ["부산"]
  },
  {
    id: "client-3",
    label: "바이오 센터",
    description: "담당 이영희"
  }
];

describe("searchable select helpers", () => {
  it("normalizes width, case and repeated spaces", () => {
    expect(normalizeSearchText("  ＡＣＭＥ   LAB  ")).toBe("acme lab");
  });

  it("searches labels, descriptions and keywords with every query term", () => {
    expect(filterSearchableOptions(options, "가나다 김철수").map((option) => option.id)).toEqual(["client-1"]);
    expect(filterSearchableOptions(options, "acme jane").map((option) => option.id)).toEqual(["client-2"]);
    expect(filterSearchableOptions(options, "부산").map((option) => option.id)).toEqual(["client-2"]);
  });

  it("excludes already selected IDs and respects the result limit", () => {
    expect(filterSearchableOptions(options, "", ["client-1"], 1).map((option) => option.id)).toEqual(["client-2"]);
  });
});

describe("SearchableSelect", () => {
  it("renders an accessible search input and a separate hidden ID field", () => {
    const markup = renderToStaticMarkup(
      <SearchableSelect
        label="거래처"
        name="clientId"
        onChange={vi.fn()}
        options={options}
        placeholder="거래처 검색"
        required
        value="client-1"
      />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('type="text"');
    expect(markup).toContain('inputMode="search"');
    expect(markup).toContain('value="가나다 연구소"');
    const hiddenInput = markup.match(/<input[^>]*type="hidden"[^>]*>/)?.[0] ?? "";
    expect(hiddenInput).toContain('name="clientId"');
    expect(hiddenInput).toContain('value="client-1"');
  });
});
