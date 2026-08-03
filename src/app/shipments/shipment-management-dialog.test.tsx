import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  cancelShipment: "/shipments/delete",
  updateShipment: "/shipments/update"
}));

import { ShipmentManagementDialog } from "./shipment-management-dialog";

describe("ShipmentManagementDialog", () => {
  it("allows memo updates and a reversible delete", () => {
    const markup = renderToStaticMarkup(<ShipmentManagementDialog shipment={{
      id: "shipment-1",
      orderId: "order-1",
      orderNo: "ORD-001",
      clientName: "테스트 병원",
      shippedAt: "2026-08-03",
      itemSummary: "R-001 2",
      itemDetails: [{ code: "R-001 · LOT-1 · 완제품", quantity: 2 }],
      memo: "긴급 출고",
      editableMemo: "긴급 출고",
      orderImage: { fileName: "주문서.png", byteSize: 2048 },
      status: "정상 출고",
      canEdit: true,
      canCancel: true,
      source: "database"
    }} />);

    expect(markup).toContain("출고 수정 및 삭제");
    expect(markup).toContain("수정 저장");
    expect(markup).toContain("출고 삭제");
    expect(markup).toContain("긴급 출고");
    expect(markup).toContain("품목·수량은 수정할 수 없습니다");
    expect(markup).toContain("주문 첨부 이미지");
    expect(markup).toContain("주문서.png");
    expect(markup).toContain('href="/api/orders/order-1/image"');
  });

  it("keeps editing available while explaining a blocked delete", () => {
    const markup = renderToStaticMarkup(<ShipmentManagementDialog shipment={{
      id: "shipment-1",
      orderId: "order-1",
      orderNo: "ORD-001",
      clientName: "테스트 병원",
      shippedAt: "2026-08-03",
      itemSummary: "R-001 2",
      itemDetails: [{ code: "R-001", quantity: 2 }],
      memo: "-",
      editableMemo: "",
      orderImage: null,
      status: "부분 출고",
      canEdit: true,
      canCancel: false,
      cancellationBlockedReason: "부족분 출고 취소 후 삭제할 수 있습니다.",
      source: "database"
    }} />);

    expect(markup).toContain("수정 저장");
    expect(markup).not.toContain("출고 삭제</span>");
    expect(markup).toContain("부족분 출고 취소 후 삭제할 수 있습니다.");
  });
});
