import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/form", () => ({
  default: ({ action: _action, children, ...props }: { action: string; children: ReactNode }) => (
    <form {...props}>{children}</form>
  )
}));

vi.mock("./progress-link", () => ({
  ProgressLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("./table-search-submit", () => ({
  TableSearchSubmit: () => <button type="submit">조회</button>
}));

import { TableSearch } from "./table-search";

const statusFilter = {
  label: "상태",
  name: "status",
  options: [{ label: "전체 상태", value: "" }, { label: "정상", value: "NORMAL" }],
  value: "NORMAL"
};

describe("TableSearch", () => {
  it("keeps the legacy single-filter prop working", () => {
    const markup = renderToStaticMarkup(
      <TableSearch
        filter={statusFilter}
        pathname="/lots"
        placeholder="재고 검색"
      />
    );

    expect(markup).toContain('name="status"');
    expect(markup).toContain("1개 조건이 적용되어 있습니다.");
    expect(markup).not.toContain("table-search-multi-filter");
  });

  it("renders and counts multiple filters together with the query", () => {
    const markup = renderToStaticMarkup(
      <TableSearch
        filters={[
          statusFilter,
          {
            label: "창고",
            name: "warehouse",
            options: [{ label: "전체 창고", value: "" }, { label: "검체", value: "SAMPLE" }],
            value: "SAMPLE"
          }
        ]}
        pathname="/lots"
        placeholder="재고 검색"
        value="EGG"
      />
    );

    expect(markup).toContain('name="status"');
    expect(markup).toContain('name="warehouse"');
    expect(markup).toContain("3개 조건이 적용되어 있습니다.");
    expect(markup).toContain("table-search-multi-filter");
  });

  it("renders inclusive date-range fields with native range constraints", () => {
    const markup = renderToStaticMarkup(
      <TableSearch
        filters={[
          {
            kind: "date",
            label: "시작일",
            max: "2026-07-21",
            name: "from",
            value: "2026-07-01"
          },
          {
            kind: "date",
            label: "종료일",
            min: "2026-07-01",
            name: "to",
            value: "2026-07-21"
          }
        ]}
        pathname="/orders"
        placeholder="주문 검색"
      />
    );

    const fromInput = markup.match(/<input[^>]*name="from"[^>]*\/>/)?.[0] ?? "";
    const toInput = markup.match(/<input[^>]*name="to"[^>]*\/>/)?.[0] ?? "";
    expect(fromInput).toContain('max="2026-07-21"');
    expect(fromInput).toContain('type="date"');
    expect(toInput).toContain('min="2026-07-01"');
    expect(toInput).toContain('type="date"');
    expect(markup).toContain("table-search-multi-filter");
  });
});
