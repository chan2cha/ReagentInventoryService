import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ShipmentOrderRow } from "./shipment-data";

vi.mock("./actions", () => ({ confirmShipment: "/shipments/confirm" }));

import {
  prioritizeShipmentLot,
  shipmentPreflightError,
  ShipmentAllocationDialog
} from "./shipment-allocation-dialog";

const lots = [
  {
    id: "lot-shared:FINISHED_GOODS",
    lotId: "lot-shared",
    lotNo: "LOT-SHARED",
    warehouse: "FINISHED_GOODS",
    warehouseName: "완제품",
    expirationDate: "2026-08-01",
    currentQuantity: 3,
    recommendedQuantity: 3
  },
  {
    id: "lot-shared:SAMPLE",
    lotId: "lot-shared",
    lotNo: "LOT-SHARED",
    warehouse: "SAMPLE",
    warehouseName: "검체",
    expirationDate: "2026-09-01",
    currentQuantity: 10,
    recommendedQuantity: 2
  }
];

describe("ShipmentAllocationDialog", () => {
  it("reallocates the order from a user-selected LOT first", () => {
    expect(prioritizeShipmentLot(lots, 5, "lot-shared:SAMPLE")).toEqual({
      "lot-shared:SAMPLE": 5,
      "lot-shared:FINISHED_GOODS": 0
    });
  });

  it("keeps splitting across other LOTs when the preferred LOT is insufficient", () => {
    expect(prioritizeShipmentLot(lots, 5, "lot-shared:FINISHED_GOODS")).toEqual({
      "lot-shared:FINISHED_GOODS": 3,
      "lot-shared:SAMPLE": 2
    });
  });

  it("renders an explicit LOT-change action and editable quantities", () => {
    const order: ShipmentOrderRow = {
      id: "order-1",
      orderNo: "ORD-20260729-001",
      clientName: "테스트 병원",
      clientManager: "김담당",
      orderDate: "2026-07-29",
      items: "EGG-01 5",
      itemDetails: [{ code: "EGG-01", quantity: 5 }],
      origin: "신규주문",
      status: "접수",
      source: "database",
      allocationItems: [{
        id: "item-1",
        code: "EGG-01",
        name: "난백",
        quantity: 5,
        availableQuantity: 13,
        lots
      }]
    };

    const markup = renderToStaticMarkup(<ShipmentAllocationDialog order={order} />);

    expect(markup).toContain("이 제조번호 선택");
    expect(markup).toContain("완제품");
    expect(markup).toContain("검체");
    expect(markup).toContain("추천안 복원");
    expect(markup).toContain("배정 5개 · 배정 완료");
    expect(markup).toContain('name="lotId"');
    expect(markup).toContain('name="warehouse"');
    expect(markup).toContain('name="quantity"');
    expect(markup).toContain('name="shipmentMemo"');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain("선택 입력 · 최대 500자");
    expect(markup).toContain('aria-required="false"');
    expect(markup).toContain("LOT 변경 사유나 출고 시 참고사항");
  });

  it("requires a shipment memo when the recommended allocation is partial", () => {
    const partialLots = lots.map((lot, index) => ({
      ...lot,
      recommendedQuantity: index === 0 ? 3 : 0
    }));
    const order: ShipmentOrderRow = {
      id: "order-partial",
      orderNo: "ORD-20260729-002",
      clientName: "테스트 병원",
      clientManager: "김담당",
      orderDate: "2026-07-29",
      items: "EGG-01 5",
      itemDetails: [{ code: "EGG-01", quantity: 5 }],
      origin: "신규주문",
      status: "접수",
      source: "database",
      allocationItems: [{
        id: "item-partial",
        code: "EGG-01",
        name: "난백",
        quantity: 5,
        availableQuantity: 3,
        lots: partialLots
      }]
    };

    const markup = renderToStaticMarkup(<ShipmentAllocationDialog order={order} />);

    expect(markup).toContain("부분 출고 시 필수 · 최대 500자");
    expect(markup).toContain('aria-required="true"');
  });

  it("reports client-known shipment errors before submission", () => {
    const item = {
      id: "item-1",
      code: "EGG-01",
      name: "난백",
      quantity: 5,
      availableQuantity: 5,
      lots
    };

    expect(shipmentPreflightError([item], { "item-1": 0 }, "")).toBe(
      "출고할 수량을 1개 이상 배정하세요."
    );
    expect(shipmentPreflightError([item], { "item-1": 6 }, "")).toBe(
      "EGG-01 시약은 주문 수량 5개를 초과해 출고할 수 없습니다."
    );
    expect(shipmentPreflightError([item], { "item-1": 3 }, "   ")).toBe(
      "부분 출고 시에는 출고 메모를 반드시 입력하세요."
    );
    expect(shipmentPreflightError([item], { "item-1": 5 }, "")).toBeNull();
  });
});
