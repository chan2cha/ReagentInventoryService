import ExcelJS from "exceljs";

export const RECEIVING_IMPORT_HEADERS = [
  "시약명",
  "제조번호",
  "입고수량",
  "입고창고명",
  "입고일",
  "유통기한",
  "메모"
] as const;

export const RECEIVING_IMPORT_ROW_LIMIT = 200;
export const RECEIVING_IMPORT_FILE_LIMIT = 3_000_000;

export type ReceivingImportRow = {
  rowNumber: number;
  allergenName: string;
  lotNo: string;
  quantity: number;
  warehouseName: string;
  receivedDate: Date;
  expirationDate: Date;
  memo: string;
};

export class ReceivingImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceivingImportError";
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  throw new ReceivingImportError("수식이나 지원하지 않는 형식의 셀이 포함되어 있습니다.");
}

function dateValue(value: ExcelJS.CellValue, rowNumber: number, field: string): Date {
  let result: Date;

  if (value instanceof Date) {
    result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  } else {
    let text = cellText(value);
    if (/^\d{8}$/.test(text)) {
      text = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    } else if (/^\d{4}[./]\d{2}[./]\d{2}$/.test(text)) {
      text = text.replace(/[./]/g, "-");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new ReceivingImportError(`${rowNumber}행 ${field}: YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력하세요.`);
    }
    result = new Date(`${text}T00:00:00.000Z`);
    if (result.toISOString().slice(0, 10) !== text) {
      throw new ReceivingImportError(`${rowNumber}행 ${field}: 존재하지 않는 날짜입니다.`);
    }
  }

  if (Number.isNaN(result.getTime())) {
    throw new ReceivingImportError(`${rowNumber}행 ${field}: 날짜가 올바르지 않습니다.`);
  }
  return result;
}

function requiredText(value: ExcelJS.CellValue, rowNumber: number, field: string, maxLength: number) {
  const text = cellText(value);
  if (!text) throw new ReceivingImportError(`${rowNumber}행 ${field}: 값을 입력하세요.`);
  if (text.length > maxLength) {
    throw new ReceivingImportError(`${rowNumber}행 ${field}: ${maxLength}자 이하로 입력하세요.`);
  }
  return text;
}

export async function parseReceivingWorkbook(data: ArrayBuffer): Promise<ReceivingImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new ReceivingImportError("엑셀 파일을 읽을 수 없습니다. 제공된 템플릿을 사용하세요.");
  }

  const sheet = workbook.getWorksheet("입고등록") ?? workbook.worksheets[0];
  if (!sheet) throw new ReceivingImportError("입고등록 시트를 찾을 수 없습니다.");

  RECEIVING_IMPORT_HEADERS.forEach((header, index) => {
    if (cellText(sheet.getRow(1).getCell(index + 1).value) !== header) {
      throw new ReceivingImportError(`1행 ${index + 1}열의 제목은 '${header}'이어야 합니다.`);
    }
  });

  const populatedRows = sheet.getRows(2, Math.max(0, sheet.rowCount - 1))?.filter((row) =>
    RECEIVING_IMPORT_HEADERS.some((_, index) => cellText(row.getCell(index + 1).value) !== "")
  ) ?? [];

  if (populatedRows.length === 0) throw new ReceivingImportError("등록할 입고 내역이 없습니다.");
  if (populatedRows.length > RECEIVING_IMPORT_ROW_LIMIT) {
    throw new ReceivingImportError(`한 번에 최대 ${RECEIVING_IMPORT_ROW_LIMIT}건까지 등록할 수 있습니다.`);
  }

  return populatedRows.map((row) => {
    const rowNumber = row.number;
    const quantityText = requiredText(row.getCell(3).value, rowNumber, "입고수량", 10);
    const quantity = Number(quantityText);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new ReceivingImportError(`${rowNumber}행 입고수량: 1 이상의 정수를 입력하세요.`);
    }

    const receivedDate = dateValue(row.getCell(5).value, rowNumber, "입고일");
    const expirationDate = dateValue(row.getCell(6).value, rowNumber, "유통기한");
    if (expirationDate <= receivedDate) {
      throw new ReceivingImportError(`${rowNumber}행 유통기한: 입고일보다 이후여야 합니다.`);
    }

    const memo = cellText(row.getCell(7).value);
    if (memo.length > 1_000) {
      throw new ReceivingImportError(`${rowNumber}행 메모: 1,000자 이하로 입력하세요.`);
    }

    return {
      rowNumber,
      allergenName: requiredText(row.getCell(1).value, rowNumber, "시약명", 200),
      lotNo: requiredText(row.getCell(2).value, rowNumber, "제조번호", 200),
      quantity,
      warehouseName: requiredText(row.getCell(4).value, rowNumber, "입고창고명", 200),
      receivedDate,
      expirationDate,
      memo
    };
  });
}
