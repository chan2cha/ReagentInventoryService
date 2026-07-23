import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  adjustLotStock: "/lots/adjust",
  transferLotWarehouse: "/lots/transfer"
}));

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

import { InventoryManagementDialog } from "./inventory-management-dialog";

function renderDialog(currentQuantity = 5) {
  return renderToStaticMarkup(
    <InventoryManagementDialog
      allergenCode="EGG-01"
      allergenName="난백"
      currentQuantity={currentQuantity}
      disabled={false}
      expirationDate="2027.07.31"
      lotId="lot-1"
      lotNo="LOT-EGG-001"
      warehouse="FINISHED_GOODS"
    />
  );
}

describe("InventoryManagementDialog", () => {
  it("renders one inventory-management trigger and one dialog with both modes", () => {
    const markup = renderDialog();

    expect(markup.match(/<dialog/g)).toHaveLength(1);
    expect(markup.match(/재고 관리/g)?.length).toBeGreaterThanOrEqual(2);
    expect(markup).toContain("재고 조정");
    expect(markup).toContain("창고 이동");
    expect(markup).toContain("수량 추가");
    expect(markup).toContain("수량 차감");
    expect(markup).toContain("폐기");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-labelledby=');
  });

  it("keeps management available at zero stock while disabling only warehouse transfer", () => {
    const markup = renderDialog(0);

    expect(markup).toContain("현재 수량이 없어 창고 이동은 사용할 수 없습니다.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*role="tab"[^>]*>창고 이동<\/button>/);
    expect(markup).not.toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*disabled/);
  });
});
