import { Buffer } from "node:buffer";
import ExcelJS, { type Worksheet } from "exceljs";

const BRAND_BLUE = "FF2563EB";
const WHITE = "FFFFFFFF";
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE_FORMAT = "yyyy-mm-dd";
const DATE_TIME_FORMAT = "yyyy-mm-dd hh:mm:ss";

export type ExportMetadataFilter = {
  label: string;
  value: string;
};

export type ExportMetadata = {
  generatedBy: string;
  generatedAt: Date | string;
  filters?: readonly ExportMetadataFilter[];
};

export type InventoryExportRow = {
  reagentCode: string;
  reagentName: string;
  category?: string | null;
  lotNo: string;
  warehouse: string;
  receivedDate: Date | string;
  expirationDate: Date | string;
  initialQuantity: number;
  currentQuantity: number;
  minStock?: number | null;
  status: string;
  isActive?: boolean;
  memo?: string | null;
};

export type MovementExportRow = {
  occurredAt: Date | string;
  type: string;
  reagentCode: string;
  reagentName: string;
  lotNo: string;
  warehouse: string;
  destinationWarehouse?: string | null;
  expirationDate?: Date | string | null;
  recordedQuantity: number;
  stockDelta: number;
  reason?: string | null;
  referenceType?: string | null;
  orderNo?: string | null;
  clientName?: string | null;
  actorName?: string | null;
};

export type OrderHistoryExportRow = {
  orderedAt: Date | string;
  orderNo: string;
  status: string;
  clientName: string;
  clientManager?: string | null;
  reagentCode: string;
  reagentName: string;
  quantity: number;
  memo?: string | null;
  hasImage?: boolean;
  creatorName?: string | null;
};

export type BuildExportWorkbookInput = {
  inventory?: readonly InventoryExportRow[];
  movements?: readonly MovementExportRow[];
  orders?: readonly OrderHistoryExportRow[];
  metadata: ExportMetadata;
};

type SheetColumn = {
  header: string;
  key: string;
  width: number;
};

function parseDate(value: Date | string, field: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`INVALID_EXPORT_DATE:${field}`);
  }

  return date;
}

function toDateOnly(value: Date | string, field: string) {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());

    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

      if (
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day)
      ) {
        return date;
      }
    }
  }

  const date = parseDate(value, field);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Excel serial dates do not retain a timezone. Shifting the instant makes the
 * calendar fields shown by Excel represent Korea Standard Time consistently.
 */
function toKoreaExcelDate(value: Date | string, field: string) {
  return new Date(parseDate(value, field).getTime() + KOREA_OFFSET_MS);
}

function toKoreaDateOnly(value: Date | string, field: string) {
  const koreaDate = toKoreaExcelDate(value, field);

  return new Date(Date.UTC(
    koreaDate.getUTCFullYear(),
    koreaDate.getUTCMonth(),
    koreaDate.getUTCDate()
  ));
}

function finiteNumber(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`INVALID_EXPORT_NUMBER:${field}`);
  }

  return value;
}

function configureSheet(worksheet: Worksheet, columns: readonly SheetColumn[]) {
  worksheet.columns = columns.map((column) => ({ ...column }));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length }
  };

  const header = worksheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_BLUE }
    };
    cell.font = {
      bold: true,
      color: { argb: WHITE }
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
  });
}

function addInformationSheet(
  workbook: ExcelJS.Workbook,
  input: BuildExportWorkbookInput,
  generatedAt: Date
) {
  const worksheet = workbook.addWorksheet("내보내기정보");
  configureSheet(worksheet, [
    { header: "항목", key: "label", width: 24 },
    { header: "내용", key: "value", width: 64 }
  ]);

  worksheet.addRow({ label: "생성자", value: input.metadata.generatedBy });
  const generatedAtRow = worksheet.addRow({
    label: "생성 시각 (KST)",
    value: toKoreaExcelDate(generatedAt, "metadata.generatedAt")
  });
  generatedAtRow.getCell(2).numFmt = DATE_TIME_FORMAT;

  const filters = input.metadata.filters ?? [];
  if (filters.length === 0) {
    worksheet.addRow({ label: "필터", value: "전체" });
  } else {
    for (const filter of filters) {
      worksheet.addRow({ label: `필터 · ${filter.label}`, value: filter.value });
    }
  }

  if (input.inventory !== undefined) {
    worksheet.addRow({ label: "재고현황 건수", value: input.inventory.length });
  }

  if (input.movements !== undefined) {
    worksheet.addRow({ label: "입출고이력 건수", value: input.movements.length });
  }

  if (input.orders !== undefined) {
    worksheet.addRow({
      label: "주문 건수",
      value: new Set(input.orders.map((row) => row.orderNo)).size
    });
    worksheet.addRow({ label: "주문 품목 건수", value: input.orders.length });
  }

  worksheet.getColumn(2).alignment = { vertical: "middle", wrapText: true };
}

function addInventorySheet(workbook: ExcelJS.Workbook, rows: readonly InventoryExportRow[]) {
  const worksheet = workbook.addWorksheet("재고현황");
  configureSheet(worksheet, [
    { header: "시약 코드", key: "reagentCode", width: 16 },
    { header: "시약명", key: "reagentName", width: 24 },
    { header: "분류", key: "category", width: 16 },
    { header: "제조번호", key: "lotNo", width: 20 },
    { header: "창고", key: "warehouse", width: 14 },
    { header: "입고일", key: "receivedDate", width: 13 },
    { header: "유통기한", key: "expirationDate", width: 13 },
    { header: "LOT 최초 수량", key: "initialQuantity", width: 15 },
    { header: "현재 수량", key: "currentQuantity", width: 12 },
    { header: "안전 수량", key: "minStock", width: 12 },
    { header: "상태", key: "status", width: 16 },
    { header: "활성 여부", key: "isActive", width: 12 },
    { header: "메모", key: "memo", width: 32 }
  ]);

  for (const [index, row] of rows.entries()) {
    worksheet.addRow({
      reagentCode: row.reagentCode,
      reagentName: row.reagentName,
      category: row.category ?? "",
      lotNo: row.lotNo,
      warehouse: row.warehouse,
      receivedDate: toDateOnly(row.receivedDate, `inventory[${index}].receivedDate`),
      expirationDate: toDateOnly(row.expirationDate, `inventory[${index}].expirationDate`),
      initialQuantity: finiteNumber(row.initialQuantity, `inventory[${index}].initialQuantity`),
      currentQuantity: finiteNumber(row.currentQuantity, `inventory[${index}].currentQuantity`),
      minStock: row.minStock === null || row.minStock === undefined
        ? ""
        : finiteNumber(row.minStock, `inventory[${index}].minStock`),
      status: row.status,
      isActive: row.isActive === false ? "비활성" : "활성",
      memo: row.memo ?? ""
    });
  }

  worksheet.getColumn("receivedDate").numFmt = DATE_FORMAT;
  worksheet.getColumn("expirationDate").numFmt = DATE_FORMAT;
  for (const key of ["initialQuantity", "currentQuantity", "minStock"]) {
    worksheet.getColumn(key).numFmt = "0";
  }
}

function addMovementSheet(workbook: ExcelJS.Workbook, rows: readonly MovementExportRow[]) {
  const worksheet = workbook.addWorksheet("입출고이력");
  configureSheet(worksheet, [
    { header: "처리일", key: "occurredAt", width: 13 },
    { header: "구분", key: "type", width: 12 },
    { header: "시약 코드", key: "reagentCode", width: 16 },
    { header: "시약명", key: "reagentName", width: 24 },
    { header: "제조번호", key: "lotNo", width: 20 },
    { header: "처리/출발 창고", key: "warehouse", width: 16 },
    { header: "도착 창고", key: "destinationWarehouse", width: 14 },
    { header: "유통기한", key: "expirationDate", width: 13 },
    { header: "기록 수량", key: "recordedQuantity", width: 12 },
    { header: "재고 증감", key: "stockDelta", width: 12 },
    { header: "사유", key: "reason", width: 32 },
    { header: "참조 유형", key: "referenceType", width: 18 },
    { header: "주문번호", key: "orderNo", width: 22 },
    { header: "거래처", key: "clientName", width: 24 },
    { header: "처리자", key: "actorName", width: 18 }
  ]);

  for (const [index, row] of rows.entries()) {
    worksheet.addRow({
      occurredAt: toKoreaDateOnly(row.occurredAt, `movements[${index}].occurredAt`),
      type: row.type,
      reagentCode: row.reagentCode,
      reagentName: row.reagentName,
      lotNo: row.lotNo,
      warehouse: row.warehouse,
      destinationWarehouse: row.destinationWarehouse ?? "",
      expirationDate: row.expirationDate === null || row.expirationDate === undefined
        ? ""
        : toDateOnly(row.expirationDate, `movements[${index}].expirationDate`),
      recordedQuantity: finiteNumber(row.recordedQuantity, `movements[${index}].recordedQuantity`),
      stockDelta: finiteNumber(row.stockDelta, `movements[${index}].stockDelta`),
      reason: row.reason ?? "",
      referenceType: row.referenceType ?? "",
      orderNo: row.orderNo ?? "",
      clientName: row.clientName ?? "",
      actorName: row.actorName ?? ""
    });
  }

  worksheet.getColumn("occurredAt").numFmt = DATE_FORMAT;
  worksheet.getColumn("expirationDate").numFmt = DATE_FORMAT;
  worksheet.getColumn("recordedQuantity").numFmt = "0";
  worksheet.getColumn("stockDelta").numFmt = "+0;-0;0";
}

function addOrderSheet(workbook: ExcelJS.Workbook, rows: readonly OrderHistoryExportRow[]) {
  const worksheet = workbook.addWorksheet("주문내역");
  configureSheet(worksheet, [
    { header: "주문일", key: "orderedAt", width: 13 },
    { header: "주문번호", key: "orderNo", width: 22 },
    { header: "상태", key: "status", width: 12 },
    { header: "거래처", key: "clientName", width: 24 },
    { header: "담당자", key: "clientManager", width: 18 },
    { header: "시약 코드", key: "reagentCode", width: 16 },
    { header: "시약명", key: "reagentName", width: 24 },
    { header: "주문 수량", key: "quantity", width: 12 },
    { header: "메모", key: "memo", width: 32 },
    { header: "이미지 첨부", key: "imageAttached", width: 14 },
    { header: "등록자", key: "creatorName", width: 18 }
  ]);

  for (const [index, row] of rows.entries()) {
    worksheet.addRow({
      orderedAt: toKoreaDateOnly(row.orderedAt, `orders[${index}].orderedAt`),
      orderNo: row.orderNo,
      status: row.status,
      clientName: row.clientName,
      clientManager: row.clientManager ?? "",
      reagentCode: row.reagentCode,
      reagentName: row.reagentName,
      quantity: finiteNumber(row.quantity, `orders[${index}].quantity`),
      memo: row.memo ?? "",
      imageAttached: row.hasImage ? "있음" : "없음",
      creatorName: row.creatorName ?? ""
    });
  }

  worksheet.getColumn("orderedAt").numFmt = DATE_FORMAT;
  worksheet.getColumn("quantity").numFmt = "0";
}

export async function buildExportWorkbook(input: BuildExportWorkbookInput): Promise<Buffer> {
  const generatedAt = parseDate(input.metadata.generatedAt, "metadata.generatedAt");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.metadata.generatedBy;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  addInformationSheet(workbook, input, generatedAt);

  if (input.inventory !== undefined) {
    addInventorySheet(workbook, input.inventory);
  }

  if (input.movements !== undefined) {
    addMovementSheet(workbook, input.movements);
  }

  if (input.orders !== undefined) {
    addOrderSheet(workbook, input.orders);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
