import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ registerDefectReplacement: "/replacements/defect" }));
vi.mock("../submit-button", () => ({
  SubmitButton: ({
    children,
    confirmMessage: _confirmMessage,
    pendingLabel: _pendingLabel,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    confirmMessage?: string;
    pendingLabel?: string;
  }) => <button type="submit" {...props}>{children}</button>
}));

import { DefectReplacementDialog } from "./defect-replacement-dialog";

describe("DefectReplacementDialog", () => {
  it("uses the shared searchable selector instead of a shipment-item dropdown", () => {
    const markup = renderToStaticMarkup(
      <DefectReplacementDialog candidates={[{
        id: "shipment-item-1",
        clientName: "테스트 병원",
        orderNo: "ORD-20260723-001",
        allergenCode: "EGG-01",
        allergenName: "계란",
        lotNo: "LOT-EGG-001",
        shippedQuantity: 3
      }]} />
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('role="combobox"');
    expect(markup).not.toContain("<select");
    expect(markup).toMatch(/type="hidden" name="shipmentItemId" value=""/);
    expect(markup).toContain("거래처, 주문번호, 시약명 또는 제조번호 검색");
  });
});
