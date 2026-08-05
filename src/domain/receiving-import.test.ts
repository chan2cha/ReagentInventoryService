import ExcelJS from "exceljs";
import {
  parseReceivingWorkbook,
  RECEIVING_IMPORT_HEADERS,
  ReceivingImportError
} from "./receiving-import";

async function workbookData(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("입고등록");
  sheet.addRow([...RECEIVING_IMPORT_HEADERS]);
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

describe("parseReceivingWorkbook", () => {
  it("parses valid receiving rows", async () => {
    const data = await workbookData([
      ["계란", "LOT-A", 12, "완제품", "2026-08-05", "2027-08-05", "정기 입고"]
    ]);

    await expect(parseReceivingWorkbook(data)).resolves.toEqual([
      expect.objectContaining({
        rowNumber: 2,
        allergenName: "계란",
        lotNo: "LOT-A",
        quantity: 12,
        warehouseName: "완제품",
        memo: "정기 입고"
      })
    ]);
  });

  it("rejects a changed template header", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("입고등록");
    sheet.addRow(["시약코드", ...RECEIVING_IMPORT_HEADERS.slice(1)]);

    await expect(parseReceivingWorkbook(await workbook.xlsx.writeBuffer()))
      .rejects.toThrow("1행 1열의 제목은 '시약명'이어야 합니다.");
  });

  it("rejects invalid dates and partial data instead of silently skipping it", async () => {
    const data = await workbookData([
      ["계란", "LOT-A", 12, "완제품", "2026-08-05", "2026-08-05", ""]
    ]);

    await expect(parseReceivingWorkbook(data)).rejects.toBeInstanceOf(ReceivingImportError);
    await expect(parseReceivingWorkbook(data)).rejects.toThrow("유통기한: 입고일보다 이후여야 합니다.");
  });

  it("normalizes compact expiration dates", async () => {
    const data = await workbookData([
      ["계란", "LOT-A", 12, "완제품", 20260805, 20270805, ""]
    ]);

    const [row] = await parseReceivingWorkbook(data);
    expect(row.receivedDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(row.expirationDate.toISOString()).toBe("2027-08-05T00:00:00.000Z");
  });
});
