import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemQuantitySummary } from "./item-quantity-summary";

describe("ItemQuantitySummary", () => {
  const items = [
    { code: "R-001", quantity: 2 },
    { code: "R-002", quantity: 3 },
    { code: "R-003", quantity: 4 }
  ];

  it("shows one or two items directly", () => {
    const markup = renderToStaticMarkup(
      <ItemQuantitySummary items={items.slice(0, 2)} summarizeAt={3} />
    );

    expect(markup).toContain("R-001");
    expect(markup).toContain("R-002");
    expect(markup).not.toContain("더보기");
    expect(markup).not.toContain('aria-haspopup="dialog"');
  });

  it("summarizes three or more items and provides all details in a dialog", () => {
    const markup = renderToStaticMarkup(
      <ItemQuantitySummary
        dialogSubtitle="ORD-20260729-001"
        items={items}
        summarizeAt={3}
      />
    );

    expect(markup).toContain("품목 3종");
    expect(markup).toContain("총 9개");
    expect(markup).toContain("더보기");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("주문 품목 상세");
    expect(markup).toContain("ORD-20260729-001");
    expect(markup).toContain("R-001");
    expect(markup).toContain("R-002");
    expect(markup).toContain("R-003");
  });
});
