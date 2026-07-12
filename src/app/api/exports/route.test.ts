import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockExportRowLimitExceededError extends Error {
    readonly code = "EXPORT_ROW_LIMIT_EXCEEDED";

    constructor(
      readonly dataset: "lots" | "movements",
      readonly limit = 10_000
    ) {
      super(`EXPORT_ROW_LIMIT_EXCEEDED:${dataset}:${limit}`);
      this.name = "ExportRowLimitExceededError";
    }
  }

  return {
    MockExportRowLimitExceededError,
    getCurrentUser: vi.fn(),
    listLotExportRows: vi.fn(),
    listMovementExportRows: vi.fn(),
    buildExportWorkbook: vi.fn(),
    auditCreate: vi.fn(),
    transaction: vi.fn()
  };
});

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/lib/excel-export", () => ({
  buildExportWorkbook: mocks.buildExportWorkbook
}));
vi.mock("@/services/export-data-service", () => ({
  EXPORT_ROW_LIMIT: 10_000,
  ExportRowLimitExceededError: mocks.MockExportRowLimitExceededError,
  listLotExportRows: mocks.listLotExportRows,
  listMovementExportRows: mocks.listMovementExportRows
}));

import { GET } from "./route";

const user = {
  id: "user-1",
  loginId: "admin",
  email: null,
  name: "관리자",
  role: "ADMIN" as const,
  mustChangePassword: false
};

const lotRow = {
  allergenCode: "R-001",
  allergenName: "집먼지진드기",
  category: "흡입성",
  lotNo: "LOT-001",
  receivedDate: new Date("2026-07-01T00:00:00.000Z"),
  expirationDate: new Date("2027-07-01T00:00:00.000Z"),
  initialQuantity: 10,
  currentQuantity: 7,
  minStock: 3,
  status: "정상",
  isActive: true,
  memo: "냉장"
};

const movementRow = {
  createdAt: new Date("2026-07-13T01:30:00.000Z"),
  type: "OUT" as const,
  typeLabel: "출고" as const,
  rawQuantity: 3,
  deltaQuantity: -3,
  allergenCode: "R-001",
  allergenName: "집먼지진드기",
  lotNo: "LOT-001",
  expirationDate: new Date("2027-07-01T00:00:00.000Z"),
  reason: "ORD-001",
  refType: "SHIPMENT",
  orderNo: "ORD-001",
  clientName: "테스트병원",
  actorName: "출고담당"
};

function request(query: string) {
  return new Request(`http://localhost/api/exports?${query}`);
}

async function json(response: Response) {
  return await response.json() as { message: string; code?: string };
}

describe("GET /api/exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.listLotExportRows.mockResolvedValue([lotRow]);
    mocks.listMovementExportRows.mockResolvedValue([movementRow]);
    mocks.buildExportWorkbook.mockResolvedValue(Buffer.from("xlsx"));
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (operation: (tx: object) => unknown) =>
      await operation({ kind: "snapshot-tx" })
    );
  });

  it("checks authentication before querying export data", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(mocks.listLotExportRows).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a viewer even when the endpoint is called directly", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...user, role: "VIEWER" });

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listLotExportRows).not.toHaveBeenCalled();
  });

  it("builds and audits a filtered inventory workbook", async () => {
    const response = await GET(request("report=inventory&q=%20R-001%20&status=LOW_STOCK"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(await response.text()).toBe("xlsx");
    expect(mocks.listLotExportRows).toHaveBeenCalledWith(
      expect.anything(),
      { q: "R-001", status: "LOW_STOCK", now: expect.any(Date) }
    );
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 15_000 }
    );
    expect(mocks.buildExportWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      inventory: [expect.objectContaining({
        reagentCode: "R-001",
        currentQuantity: 7,
        isActive: true
      })],
      movements: undefined,
      metadata: expect.objectContaining({
        generatedBy: "관리자 (admin)",
        filters: [
          { label: "검색어", value: "R-001" },
          { label: "상태", value: "재고부족" }
        ]
      })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "INVENTORY_EXPORT",
        entityType: "DATA_EXPORT",
        actorId: "user-1"
      })
    });
  });

  it("builds selected datasets into one workbook with namespaced filters", async () => {
    const response = await GET(request(
      "report=combined&datasets=inventory,movements&inventoryQ=LOT&inventoryStatus=EXPIRING&movementQ=ORD&from=2026-07-01&to=2026-07-13&type=OUT"
    ));

    expect(response.status).toBe(200);
    expect(mocks.listLotExportRows).toHaveBeenCalledWith(
      expect.anything(),
      { q: "LOT", status: "EXPIRING", now: expect.any(Date) }
    );
    expect(mocks.listMovementExportRows).toHaveBeenCalledWith(
      expect.anything(),
      { q: "ORD", from: "2026-07-01", to: "2026-07-13", type: "OUT" }
    );
    expect(mocks.buildExportWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      inventory: expect.any(Array),
      movements: [expect.objectContaining({
        recordedQuantity: 3,
        stockDelta: -3,
        referenceType: "출고",
        orderNo: "ORD-001",
        clientName: "테스트병원"
      })]
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "COMBINED_EXPORT" })
    });
  });

  it("returns a useful validation response without creating an audit record", async () => {
    mocks.listMovementExportRows.mockRejectedValue(new Error("EXPORT_FILTER_DATE_RANGE_INVALID"));

    const response = await GET(request("report=movements&from=2026-07-13&to=2026-07-01"));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      code: "EXPORT_FILTER_DATE_RANGE_INVALID",
      message: "종료일은 시작일과 같거나 이후여야 합니다."
    });
    expect(mocks.buildExportWorkbook).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();

    const invalidStatusResponse = await GET(request("report=inventory&status=low"));
    expect(invalidStatusResponse.status).toBe(400);
    expect(await json(invalidStatusResponse)).toMatchObject({
      code: "EXPORT_FILTER_STATUS_INVALID",
      message: "재고 상태가 올바르지 않습니다."
    });
  });

  it("fails closed when a filter belongs to a different report contract", async () => {
    const response = await GET(request("report=inventory&inventoryQ=LOT-001"));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: "EXPORT_PARAMETER_INVALID" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.listLotExportRows).not.toHaveBeenCalled();
  });

  it("rejects filters for a dataset omitted from a combined workbook", async () => {
    const response = await GET(request(
      "report=combined&datasets=inventory&from=2026-07-01"
    ));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: "EXPORT_PARAMETER_INVALID" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores counts and user filters as structured audit JSON", async () => {
    const q = "X; 이력 9999건=위조";
    const response = await GET(request(`report=inventory&q=${encodeURIComponent(q)}`));

    expect(response.status).toBe(200);
    const description = mocks.auditCreate.mock.calls[0][0].data.description as string;
    const payload = JSON.parse(description.slice(description.indexOf("{"))) as {
      counts: { inventory: number };
      filters: Array<{ label: string; value: string }>;
    };
    expect(payload).toEqual({
      counts: { inventory: 1 },
      filters: [{ label: "검색어", value: q }]
    });
  });

  it("blocks exports above the row limit", async () => {
    mocks.listLotExportRows.mockRejectedValue(
      new mocks.MockExportRowLimitExceededError("lots")
    );

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({ code: "EXPORT_ROW_LIMIT_EXCEEDED" });
    expect(mocks.buildExportWorkbook).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not return an oversized workbook or write a success audit", async () => {
    mocks.buildExportWorkbook.mockResolvedValue(Buffer.alloc(4_000_001));

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({ code: "EXPORT_FILE_TOO_LARGE" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects an oversized cell before ExcelJS materializes a workbook", async () => {
    mocks.listLotExportRows.mockResolvedValue([{
      ...lotRow,
      memo: "가".repeat(32_001)
    }]);

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({ code: "EXPORT_CELL_TEXT_TOO_LARGE" });
    expect(mocks.buildExportWorkbook).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not release a file when the required audit write fails", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("audit unavailable"));

    const response = await GET(request("report=inventory"));

    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({ code: "EXPORT_FAILED" });
  });
});
