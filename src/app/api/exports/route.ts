import { Buffer } from "node:buffer";

/** 권한이 있는 사용자의 필터를 검증하고 Excel 파일 다운로드 응답으로 변환한다. */
import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  buildExportWorkbook,
  type ExportMetadataFilter,
  type InventoryExportRow,
  type MovementExportRow,
  type OrderHistoryExportRow
} from "@/lib/excel-export";
import { prisma } from "@/lib/prisma";
import { getWarehouseOptions } from "@/lib/warehouse-data";
import {
  ExportRowLimitExceededError,
  EXPORT_ROW_LIMIT,
  listLotExportRows,
  listMovementExportRows,
  listOrderExportRows,
  type LotExportRow,
  type MovementExportRow as MovementDataRow,
  type OrderExportRow as OrderDataRow
} from "@/services/export-data-service";
import {
  isStockMovementKind,
  stockMovementTypeLabel
} from "@/domain/stock-movement-presentation";
import {
  isLotStatusKind,
  lotStatusLabel,
  type LotStatusKind
} from "@/domain/lot-status";
import {
  isWarehouseKind,
  warehouseLabel,
  type WarehouseKind,
  type WarehouseOption
} from "@/domain/warehouse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_EXPORT_FILE_BYTES = 4_000_000;
const MAX_QUERY_LENGTH = 200;
const MAX_CELL_TEXT_LENGTH = 32_000;
const MAX_EXPORT_TEXT_BYTES = 8_000_000;
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const EXPORT_TRANSACTION_OPTIONS = {
  isolationLevel: "RepeatableRead" as const,
  maxWait: 5_000,
  timeout: 15_000
};

type ReportKind = "inventory" | "movements" | "orders" | "combined";
type DatasetKind = "inventory" | "movements";

class ExportRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "ExportRequestError";
  }
}

function jsonError(message: string, status: number, code?: string) {
  return Response.json(
    { message, ...(code ? { code } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

function queryValue(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name)?.trim() ?? "";

  if (value.length > MAX_QUERY_LENGTH) {
    throw new ExportRequestError(
      "EXPORT_FILTER_TOO_LONG",
      "검색어는 200자 이하로 입력하세요."
    );
  }

  return value;
}

function parseReport(searchParams: URLSearchParams): ReportKind {
  const report = searchParams.get("report");

  if (
    report === "inventory" ||
    report === "movements" ||
    report === "orders" ||
    report === "combined"
  ) {
    return report;
  }

  throw new ExportRequestError(
    "EXPORT_REPORT_INVALID",
    "내보낼 자료의 종류가 올바르지 않습니다."
  );
}

function assertAllowedParameters(searchParams: URLSearchParams, report: ReportKind) {
  const allowed = {
    inventory: new Set(["report", "q", "status", "warehouse"]),
    movements: new Set(["report", "q", "from", "to", "type", "warehouse"]),
    orders: new Set(["report", "q", "from", "to"]),
    combined: new Set([
      "report",
      "datasets",
      "inventoryQ",
      "inventoryStatus",
      "inventoryWarehouse",
      "movementQ",
      "movementWarehouse",
      "from",
      "to",
      "type"
    ])
  } satisfies Record<ReportKind, Set<string>>;
  const invalid = Array.from(new Set(searchParams.keys()))
    .filter((name) => !allowed[report].has(name));

  if (invalid.length > 0) {
    throw new ExportRequestError(
      "EXPORT_PARAMETER_INVALID",
      `현재 내보내기에서 사용할 수 없는 조건입니다: ${invalid.join(", ")}`
    );
  }
}

function parseDatasets(searchParams: URLSearchParams): DatasetKind[] {
  const raw = searchParams.get("datasets") ?? "";
  const values = Array.from(new Set(raw.split(",").map((value) => value.trim()).filter(Boolean)));

  if (values.length === 0) {
    throw new ExportRequestError(
      "EXPORT_DATASET_REQUIRED",
      "통합 파일에 포함할 자료를 하나 이상 선택하세요."
    );
  }

  if (values.some((value) => value !== "inventory" && value !== "movements")) {
    throw new ExportRequestError(
      "EXPORT_DATASET_INVALID",
      "통합 파일에 포함할 자료가 올바르지 않습니다."
    );
  }

  return values as DatasetKind[];
}

function assertSelectedDatasetParameters(
  searchParams: URLSearchParams,
  datasets: readonly DatasetKind[]
) {
  const inventoryParameters = ["inventoryQ", "inventoryStatus", "inventoryWarehouse"];
  if (
    !datasets.includes("inventory") &&
    inventoryParameters.some((name) => searchParams.has(name))
  ) {
    throw new ExportRequestError(
      "EXPORT_PARAMETER_INVALID",
      "재고현황을 포함한 경우에만 재고 검색 조건을 사용할 수 있습니다."
    );
  }

  const movementParameters = ["movementQ", "movementWarehouse", "from", "to", "type"];
  if (
    !datasets.includes("movements") &&
    movementParameters.some((name) => searchParams.has(name))
  ) {
    throw new ExportRequestError(
      "EXPORT_PARAMETER_INVALID",
      "입출고이력을 포함한 경우에만 이력 검색 조건을 사용할 수 있습니다."
    );
  }
}

function fileStamp(date: Date) {
  const korea = new Date(date.getTime() + KOREA_OFFSET_MS);
  const parts = [
    korea.getUTCFullYear(),
    String(korea.getUTCMonth() + 1).padStart(2, "0"),
    String(korea.getUTCDate()).padStart(2, "0"),
    String(korea.getUTCHours()).padStart(2, "0"),
    String(korea.getUTCMinutes()).padStart(2, "0")
  ];

  return `${parts[0]}${parts[1]}${parts[2]}_${parts[3]}${parts[4]}`;
}

function encodedFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function contentDisposition(fileName: string, asciiFileName: string) {
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName(fileName)}`;
}

function inventoryWorkbookRows(rows: LotExportRow[], warehouses: readonly WarehouseOption[]): InventoryExportRow[] {
  return rows.map((row) => ({
    reagentCode: row.allergenCode,
    reagentName: row.allergenName,
    category: row.category,
    lotNo: row.lotNo,
    warehouse: warehouseLabel(row.warehouse, warehouses),
    receivedDate: row.receivedDate,
    expirationDate: row.expirationDate,
    initialQuantity: row.initialQuantity,
    currentQuantity: row.currentQuantity,
    minStock: row.minStock,
    status: row.status,
    isActive: row.isActive,
    memo: row.memo
  }));
}

function referenceTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    RECEIVING: "입고 등록",
    SHIPMENT: "출고",
    SHIPMENT_CANCEL: "출고취소",
    STOCK_ADJUSTMENT: "재고 조정",
    WAREHOUSE_TRANSFER: "창고 이동"
  };

  return value ? labels[value] ?? value : null;
}

function movementWorkbookRows(rows: MovementDataRow[], warehouses: readonly WarehouseOption[]): MovementExportRow[] {
  return rows.map((row) => ({
    occurredAt: row.createdAt,
    type: row.typeLabel,
    reagentCode: row.allergenCode,
    reagentName: row.allergenName,
    lotNo: row.lotNo,
    warehouse: warehouseLabel(row.warehouse, warehouses),
    destinationWarehouse: row.destinationWarehouse
      ? warehouseLabel(row.destinationWarehouse, warehouses)
      : null,
    expirationDate: row.expirationDate,
    recordedQuantity: row.rawQuantity,
    stockDelta: row.deltaQuantity,
    reason: row.reason,
    referenceType: referenceTypeLabel(row.refType),
    orderNo: row.orderNo,
    clientName: row.clientName,
    actorName: row.actorName
  }));
}

function warehouseFilterValue(searchParams: URLSearchParams, name: string) {
  const value = queryValue(searchParams, name);

  if (value && !isWarehouseKind(value)) {
    throw new Error("EXPORT_FILTER_WAREHOUSE_INVALID");
  }

  return value as WarehouseKind | "";
}

function orderWorkbookRows(rows: OrderDataRow[]): OrderHistoryExportRow[] {
  return rows.map((row) => ({
    orderedAt: row.createdAt,
    orderNo: row.orderNo,
    status: row.status,
    clientName: row.clientName,
    clientManager: row.clientManager,
    reagentCode: row.allergenCode,
    reagentName: row.allergenName,
    quantity: row.quantity,
    memo: row.memo,
    hasImage: row.hasImage,
    creatorName: row.creatorName
  }));
}

function movementFilterValues(
  searchParams: URLSearchParams,
  queryName = "q",
  warehouseName = "warehouse"
) {
  const q = queryValue(searchParams, queryName);
  const from = queryValue(searchParams, "from");
  const to = queryValue(searchParams, "to");
  const type = queryValue(searchParams, "type");
  const warehouse = warehouseFilterValue(searchParams, warehouseName);

  return { q, from, to, type, warehouse };
}

function orderFilterValues(searchParams: URLSearchParams) {
  return {
    q: queryValue(searchParams, "q"),
    from: queryValue(searchParams, "from"),
    to: queryValue(searchParams, "to")
  };
}

function inventoryFilterValues(
  searchParams: URLSearchParams,
  queryName = "q",
  statusName = "status",
  warehouseName = "warehouse"
) {
  const q = queryValue(searchParams, queryName);
  const statusValue = queryValue(searchParams, statusName);
  const warehouse = warehouseFilterValue(searchParams, warehouseName);

  if (statusValue && !isLotStatusKind(statusValue)) {
    throw new Error("EXPORT_FILTER_STATUS_INVALID");
  }

  return { q, status: statusValue as LotStatusKind | "", warehouse };
}

function addInventoryFilters(
  filters: ExportMetadataFilter[],
  values: ReturnType<typeof inventoryFilterValues>,
  prefix = "",
  warehouses: readonly WarehouseOption[] = []
) {
  if (values.q) filters.push({ label: `${prefix}검색어`, value: values.q });
  if (values.status) {
    filters.push({ label: `${prefix}상태`, value: lotStatusLabel(values.status) });
  }
  if (values.warehouse) {
    filters.push({ label: `${prefix}창고`, value: warehouseLabel(values.warehouse, warehouses) });
  }
}

function addMovementFilters(
  filters: ExportMetadataFilter[],
  values: ReturnType<typeof movementFilterValues>,
  prefix = "",
  warehouses: readonly WarehouseOption[] = []
) {
  if (values.q) filters.push({ label: `${prefix}검색어`, value: values.q });
  if (values.from || values.to) {
    filters.push({
      label: `${prefix}기간`,
      value: `${values.from || "처음"} ~ ${values.to || "현재"}`
    });
  }
  if (values.type && isStockMovementKind(values.type)) {
    filters.push({ label: `${prefix}구분`, value: stockMovementTypeLabel(values.type) });
  }
  if (values.warehouse) {
    filters.push({ label: `${prefix}창고`, value: warehouseLabel(values.warehouse, warehouses) });
  }
}

function addOrderFilters(
  filters: ExportMetadataFilter[],
  values: ReturnType<typeof orderFilterValues>
) {
  if (values.q) filters.push({ label: "검색어", value: values.q });
  if (values.from || values.to) {
    filters.push({
      label: "주문일",
      value: `${values.from || "처음"} ~ ${values.to || "현재"}`
    });
  }
}

function compactAuditValue(value: string) {
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function assertTextBudget(
  inventory: readonly InventoryExportRow[] | undefined,
  movements: readonly MovementExportRow[] | undefined,
  orders: readonly OrderHistoryExportRow[] | undefined,
  metadataValues: readonly string[]
) {
  let totalBytes = 0;

  function include(value: string | null | undefined, field: string) {
    if (!value) return;

    if (value.length > MAX_CELL_TEXT_LENGTH) {
      throw new ExportRequestError(
        "EXPORT_CELL_TEXT_TOO_LARGE",
        `${field} 내용이 Excel 셀 허용 길이를 초과합니다. 관리자에게 문의하세요.`,
        413
      );
    }

    totalBytes += Buffer.byteLength(value, "utf8");
    if (totalBytes > MAX_EXPORT_TEXT_BYTES) {
      throw new ExportRequestError(
        "EXPORT_TEXT_BUDGET_EXCEEDED",
        "내보낼 문자 데이터가 너무 많습니다. 기간이나 검색 조건을 좁혀 다시 시도하세요.",
        413
      );
    }
  }

  metadataValues.forEach((value, index) => include(value, `내보내기 정보 ${index + 1}`));
  inventory?.forEach((row, index) => {
    include(row.reagentCode, `재고 ${index + 1}행 시약 코드`);
    include(row.reagentName, `재고 ${index + 1}행 시약명`);
    include(row.category, `재고 ${index + 1}행 분류`);
    include(row.lotNo, `재고 ${index + 1}행 제조번호`);
    include(row.warehouse, `재고 ${index + 1}행 창고`);
    include(row.status, `재고 ${index + 1}행 상태`);
    include(row.memo, `재고 ${index + 1}행 메모`);
  });
  movements?.forEach((row, index) => {
    include(row.type, `이력 ${index + 1}행 구분`);
    include(row.reagentCode, `이력 ${index + 1}행 시약 코드`);
    include(row.reagentName, `이력 ${index + 1}행 시약명`);
    include(row.lotNo, `이력 ${index + 1}행 제조번호`);
    include(row.warehouse, `이력 ${index + 1}행 처리/출발 창고`);
    include(row.destinationWarehouse, `이력 ${index + 1}행 도착 창고`);
    include(row.reason, `이력 ${index + 1}행 사유`);
    include(row.referenceType, `이력 ${index + 1}행 참조 유형`);
    include(row.orderNo, `이력 ${index + 1}행 주문번호`);
    include(row.clientName, `이력 ${index + 1}행 거래처`);
    include(row.actorName, `이력 ${index + 1}행 처리자`);
  });
  orders?.forEach((row, index) => {
    include(row.orderNo, `주문 ${index + 1}행 주문번호`);
    include(row.status, `주문 ${index + 1}행 상태`);
    include(row.clientName, `주문 ${index + 1}행 거래처`);
    include(row.clientManager, `주문 ${index + 1}행 담당자`);
    include(row.reagentCode, `주문 ${index + 1}행 시약 코드`);
    include(row.reagentName, `주문 ${index + 1}행 시약명`);
    include(row.memo, `주문 ${index + 1}행 메모`);
    include(row.creatorName, `주문 ${index + 1}행 등록자`);
  });
}

async function generateExport(
  report: ReportKind,
  searchParams: URLSearchParams,
  user: { name: string; loginId: string },
  generatedAt: Date
) {
  const warehouses = await getWarehouseOptions(false);
  let inventory: InventoryExportRow[] | undefined;
  let movements: MovementExportRow[] | undefined;
  let orders: OrderHistoryExportRow[] | undefined;
  let orderCounts: { orders: number; orderItems: number } | undefined;
  const filters: ExportMetadataFilter[] = [];
  let action: string;
  let title: string;
  let asciiTitle: string;

  if (report === "inventory") {
    const values = inventoryFilterValues(searchParams);
    const rows = await prisma.$transaction(
      (tx) => listLotExportRows(tx, { ...values, now: generatedAt }),
      EXPORT_TRANSACTION_OPTIONS
    );
    inventory = inventoryWorkbookRows(rows, warehouses);
    addInventoryFilters(filters, values, "", warehouses);
    action = "INVENTORY_EXPORT";
    title = "재고현황";
    asciiTitle = "inventory";
  } else if (report === "movements") {
    const values = movementFilterValues(searchParams);
    const rows = await prisma.$transaction(
      (tx) => listMovementExportRows(tx, values),
      EXPORT_TRANSACTION_OPTIONS
    );
    movements = movementWorkbookRows(rows, warehouses);
    addMovementFilters(filters, values, "", warehouses);
    action = "MOVEMENT_EXPORT";
    title = "입출고이력";
    asciiTitle = "movements";
  } else if (report === "orders") {
    const values = orderFilterValues(searchParams);
    const rows = await prisma.$transaction(
      (tx) => listOrderExportRows(tx, values),
      EXPORT_TRANSACTION_OPTIONS
    );
    orders = orderWorkbookRows(rows);
    orderCounts = {
      orders: new Set(rows.map((row) => row.orderId)).size,
      orderItems: rows.length
    };
    addOrderFilters(filters, values);
    action = "ORDER_EXPORT";
    title = "주문내역";
    asciiTitle = "orders";
  } else {
    const datasets = parseDatasets(searchParams);
    assertSelectedDatasetParameters(searchParams, datasets);
    filters.push({
      label: "포함 자료",
      value: datasets.map((dataset) => dataset === "inventory" ? "재고현황" : "입출고이력").join(", ")
    });

    const inventoryValues = datasets.includes("inventory")
      ? inventoryFilterValues(
          searchParams,
          "inventoryQ",
          "inventoryStatus",
          "inventoryWarehouse"
        )
      : null;
    const movementValues = datasets.includes("movements")
      ? movementFilterValues(searchParams, "movementQ", "movementWarehouse")
      : null;
    const rows = await prisma.$transaction(async (tx) => ({
      inventory: datasets.includes("inventory")
        ? await listLotExportRows(tx, { ...inventoryValues!, now: generatedAt })
        : undefined,
      movements: movementValues
        ? await listMovementExportRows(tx, movementValues)
        : undefined
    }), EXPORT_TRANSACTION_OPTIONS);

    if (rows.inventory) {
      inventory = inventoryWorkbookRows(rows.inventory, warehouses);
      addInventoryFilters(filters, inventoryValues!, "재고 · ", warehouses);
    }

    if (rows.movements && movementValues) {
      movements = movementWorkbookRows(rows.movements, warehouses);
      addMovementFilters(filters, movementValues, "이력 · ", warehouses);
    }

    action = "COMBINED_EXPORT";
    title = "업무자료통합";
    asciiTitle = "business-data";
  }

  const generatedBy = `${user.name} (${user.loginId})`;
  assertTextBudget(
    inventory,
    movements,
    orders,
    [generatedBy, ...filters.flatMap((filter) => [filter.label, filter.value])]
  );

  const buffer = await buildExportWorkbook({
    metadata: {
      generatedBy,
      generatedAt,
      filters
    },
    inventory,
    movements,
    orders
  });

  if (buffer.length > MAX_EXPORT_FILE_BYTES) {
    throw new ExportRequestError(
      "EXPORT_FILE_TOO_LARGE",
      "생성할 파일이 너무 큽니다. 기간이나 검색 조건을 좁혀 다시 시도하세요.",
      413
    );
  }

  const auditPayload = {
    counts: {
      ...(inventory === undefined ? {} : { inventory: inventory.length }),
      ...(movements === undefined ? {} : { movements: movements.length }),
      ...(orderCounts ?? {})
    },
    filters: filters.map((filter) => ({
      label: compactAuditValue(filter.label),
      value: compactAuditValue(filter.value)
    }))
  };
  const stamp = fileStamp(generatedAt);

  return {
    action,
    auditDescription: `${title} 엑셀 생성 ${JSON.stringify(auditPayload)}`,
    buffer,
    fileName: `${title}_${stamp}.xlsx`,
    asciiFileName: `${asciiTitle}_${stamp}.xlsx`
  };
}

function filterError(error: Error) {
  const messages: Record<string, string> = {
    EXPORT_FILTER_FROM_INVALID: "시작일 형식이 올바르지 않습니다.",
    EXPORT_FILTER_TO_INVALID: "종료일 형식이 올바르지 않습니다.",
    EXPORT_FILTER_TYPE_INVALID: "입출고 구분이 올바르지 않습니다.",
    EXPORT_FILTER_STATUS_INVALID: "재고 상태가 올바르지 않습니다.",
    EXPORT_FILTER_WAREHOUSE_INVALID: "창고 구분이 올바르지 않습니다.",
    EXPORT_FILTER_DATE_RANGE_INVALID: "종료일은 시작일과 같거나 이후여야 합니다."
  };

  return messages[error.message];
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonError("로그인 후 다시 시도하세요.", 401, "UNAUTHENTICATED");
    }

    if (user.mustChangePassword) {
      return jsonError("비밀번호를 변경한 후 자료를 내보낼 수 있습니다.", 403, "PASSWORD_CHANGE_REQUIRED");
    }

    if (!can(user.role, "DATA_EXPORT")) {
      return jsonError("자료 내보내기 권한이 없습니다.", 403, "FORBIDDEN");
    }

    const url = new URL(request.url);
    const report = parseReport(url.searchParams);
    assertAllowedParameters(url.searchParams, report);
    const generatedAt = new Date();
    const generated = await generateExport(report, url.searchParams, user, generatedAt);

    await prisma.auditLog.create({
      data: {
        action: generated.action,
        entityType: "DATA_EXPORT",
        entityId: null,
        description: generated.auditDescription,
        actorId: user.id
      }
    });

    return new Response(Uint8Array.from(generated.buffer), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": contentDisposition(generated.fileName, generated.asciiFileName),
        "Content-Length": String(generated.buffer.length),
        "Content-Type": EXCEL_MIME_TYPE,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof ExportRequestError) {
      return jsonError(error.message, error.status, error.code);
    }

    if (error instanceof ExportRowLimitExceededError) {
      return jsonError(
        `내보내기 결과가 ${EXPORT_ROW_LIMIT.toLocaleString("ko-KR")}건을 초과합니다. 기간이나 검색 조건을 좁혀주세요.`,
        422,
        error.code
      );
    }

    if (error instanceof Error) {
      const message = filterError(error);
      if (message) return jsonError(message, 400, error.message);
    }

    console.error("[data-export] workbook generation failed", error);
    return jsonError(
      "엑셀 파일을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
      500,
      "EXPORT_FAILED"
    );
  }
}
