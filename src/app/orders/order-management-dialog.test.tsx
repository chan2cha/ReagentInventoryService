import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  cancelOrder: "/orders/delete",
  updateOrder: "/orders/update",
  updateOrderMetadata: "/orders/update-metadata"
}));

import { OrderManagementDialog } from "./order-management-dialog";

describe("OrderManagementDialog", () => {
  it("prefills an editable order and exposes update and delete actions", () => {
    const markup = renderToStaticMarkup(<OrderManagementDialog
      allergens={[{ id: "allergen-1", code: "R-001", name: "시약 1" }]}
      clients={[{
        id: "client-1",
        name: "테스트 병원",
        region: "서울",
        manager: "김담당",
        deliveryDepartment: "진단검사의학과"
      }]}
      order={{
        id: "order-1",
        orderNo: "ORD-001",
        clientId: "client-1",
        clientName: "테스트 병원",
        clientManager: "김담당",
        orderDate: "2026-08-03",
        items: "R-001 2",
        itemDetails: [{ code: "R-001", quantity: 2 }],
        editableItems: [{ allergenId: "allergen-1", quantity: 2 }],
        memo: "긴급",
        image: null,
        origin: "신규주문",
        status: "접수",
        canEdit: true,
        canEditFully: true,
        canCancel: true,
        source: "database"
      }}
    />);

    expect(markup).toContain("주문 수정 및 삭제");
    expect(markup).toContain("수정 저장");
    expect(markup).toContain("주문 삭제");
    expect(markup).toContain("긴급");
    expect(markup).toContain('name="allergenId"');
    expect(markup).toContain('value="2"');
  });

  it("limits a shipped order to its memo and attachment", () => {
    const markup = renderToStaticMarkup(<OrderManagementDialog
      allergens={[{ id: "allergen-1", code: "R-001", name: "시약 1" }]}
      clients={[{
        id: "client-1", name: "테스트 병원", region: null,
        manager: "김담당", deliveryDepartment: null
      }]}
      order={{
        id: "order-1",
        orderNo: "ORD-001",
        clientId: "client-1",
        clientName: "테스트 병원",
        clientManager: "김담당",
        orderDate: "2026-08-03",
        items: "R-001 2",
        itemDetails: [{ code: "R-001", quantity: 2 }],
        editableItems: [{ allergenId: "allergen-1", quantity: 2 }],
        memo: "출고 완료",
        image: { fileName: "주문서.png", byteSize: 2048 },
        origin: "신규주문",
        status: "출고완료",
        canEdit: true,
        canEditFully: false,
        canCancel: false,
        source: "database"
      }}
    />);

    expect(markup).toContain("메모와 첨부 이미지만 수정할 수 있습니다");
    expect(markup).toContain("주문서.png");
    expect(markup).toContain('name="memo"');
    expect(markup).not.toContain('name="clientId"');
    expect(markup).not.toContain('name="allergenId"');
    expect(markup).not.toContain("주문 삭제");
  });
});
