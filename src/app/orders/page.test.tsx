import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getOrderRows: vi.fn(),
  getFlashMessage: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/flash-message", () => ({ getFlashMessage: mocks.getFlashMessage }));
vi.mock("./actions", () => ({ cancelOrder: "/orders/cancel" }));
vi.mock("./order-data", () => ({
  formatDate: (value: string) => value,
  getOrderRows: mocks.getOrderRows,
  orderSourceLabel: () => "최신 정보"
}));
vi.mock("../reagent-ui", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Panel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>
}));
vi.mock("../submit-button", () => ({
  SubmitButton: ({ children }: { children: ReactNode }) => <button>{children}</button>
}));
vi.mock("../pagination", () => ({ Pagination: () => null }));
vi.mock("../table-search", () => ({ TableSearch: () => null }));
vi.mock("../exports/export-download-button", () => ({
  ExportDownloadButton: ({
    disabled,
    label,
    query
  }: {
    disabled?: boolean;
    label: string;
    query: Record<string, string | undefined>;
  }) => <button data-disabled={String(Boolean(disabled))} data-query={JSON.stringify(query)}>{label}</button>
}));
vi.mock("../flash-message", () => ({ FlashMessage: () => null }));
vi.mock("../item-quantity-summary", () => ({ ItemQuantitySummary: () => <span>R-001 2</span> }));

import OrdersPage from "./page";

describe("OrdersPage image attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ role: "VIEWER" });
    mocks.getFlashMessage.mockResolvedValue(null);
    mocks.getOrderRows.mockResolvedValue({
      page: 1,
      total: 1,
      totalPages: 1,
      rows: [{
        id: "order-1",
        orderNo: "ORD-20260721-001",
        clientName: "테스트 병원",
        clientManager: "김담당",
        orderDate: "2026-07-21",
        items: "R-001 2",
        itemDetails: [{ code: "R-001", quantity: 2 }],
        memo: "이미지 주문",
        image: { fileName: "order.png", byteSize: 2048 },
        origin: "직접 등록",
        status: "접수",
        canCancel: true,
        source: "database"
      }]
    });
  });

  it("shows image metadata and a direct view link to a read-only user", async () => {
    const markup = renderToStaticMarkup(await OrdersPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain("첨부 이미지");
    expect(markup).toContain("order.png");
    expect(markup).toContain("2 KB");
    expect(markup).toContain('href="/api/orders/order-1/image"');
    expect(markup).toContain("이미지 보기");
    expect(markup).not.toContain("주문 취소");
    expect(markup).not.toContain("현재 조건 엑셀");
  });

  it("shows an order-date Excel export with the same list filters to an authorized user", async () => {
    mocks.requireUser.mockResolvedValue({ role: "ORDER_MANAGER" });

    const markup = renderToStaticMarkup(await OrdersPage({
      searchParams: Promise.resolve({
        q: "R-001",
        from: "2026-07-01",
        to: "2026-07-21"
      })
    }));

    expect(mocks.getOrderRows).toHaveBeenCalledWith(
      1,
      "R-001",
      "2026-07-01",
      "2026-07-21"
    );
    expect(markup).toContain("현재 조건 엑셀");
    expect(markup).toContain('&quot;report&quot;:&quot;orders&quot;');
    expect(markup).toContain('&quot;from&quot;:&quot;2026-07-01&quot;');
    expect(markup).toContain('data-disabled="false"');
  });

  it("rejects a reversed date range before querying or exporting it", async () => {
    mocks.requireUser.mockResolvedValue({ role: "ORDER_MANAGER" });

    const markup = renderToStaticMarkup(await OrdersPage({
      searchParams: Promise.resolve({
        from: "2026-07-22",
        to: "2026-07-21"
      })
    }));

    expect(mocks.getOrderRows).toHaveBeenCalledWith(1, undefined, "", "");
    expect(markup).toContain("종료일은 시작일과 같거나 이후여야 합니다.");
    expect(markup).toContain('data-disabled="true"');
  });
});
