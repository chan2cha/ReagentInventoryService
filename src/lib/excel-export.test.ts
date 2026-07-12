import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildExportWorkbook } from "./excel-export";

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function rowValues(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  return worksheet.getRow(rowNumber).values;
}

function expectFrozenHeaderAndFilter(worksheet: ExcelJS.Worksheet, lastColumn: number) {
  expect(worksheet.views).toEqual(expect.arrayContaining([
    expect.objectContaining({ state: "frozen", ySplit: 1 })
  ]));
  expect(worksheet.autoFilter).toBe(`A1:${String.fromCharCode(64 + lastColumn)}1`);
}

describe("buildExportWorkbook", () => {
  it("builds ordered sheets with typed dates, quantities, metadata, and movement deltas", async () => {
    const buffer = await buildExportWorkbook({
      metadata: {
        generatedBy: "관리자",
        generatedAt: new Date("2026-07-12T15:00:00.000Z"),
        filters: [
          { label: "검색어", value: "우유" },
          { label: "기간", value: "2026-07-01 ~ 2026-07-13" }
        ]
      },
      inventory: [{
        reagentCode: "MILK-01",
        reagentName: "우유 단백질",
        category: "식품",
        lotNo: "LOT-001",
        receivedDate: "2026-07-01",
        expirationDate: "2027-07-01",
        initialQuantity: 12,
        currentQuantity: 7,
        minStock: 3,
        status: "정상",
        isActive: true,
        memo: "=SUM(1,1)"
      }],
      movements: [{
        occurredAt: new Date("2026-07-12T15:30:45.000Z"),
        type: "출고",
        reagentCode: "MILK-01",
        reagentName: "우유 단백질",
        lotNo: "LOT-001",
        expirationDate: "2027-07-01",
        recordedQuantity: 5,
        stockDelta: -5,
        reason: "@외부참조",
        referenceType: "출고",
        orderNo: "ORD-001",
        clientName: "테스트병원",
        actorName: "출고 담당자"
      }]
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = await loadWorkbook(buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "내보내기정보",
      "재고현황",
      "입출고이력"
    ]);

    const information = workbook.getWorksheet("내보내기정보")!;
    expect(rowValues(information, 1)).toEqual([undefined, "항목", "내용"]);
    expect(information.getCell("A2").value).toBe("생성자");
    expect(information.getCell("B2").value).toBe("관리자");
    expect(information.getCell("B3").type).toBe(ExcelJS.ValueType.Date);
    expect((information.getCell("B3").value as Date).toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(information.getCell("A4").value).toBe("필터 · 검색어");
    expect(information.getCell("A6").value).toBe("재고현황 건수");
    expect(information.getCell("B6").value).toBe(1);
    expect(information.getCell("A7").value).toBe("입출고이력 건수");
    expect(information.getCell("B7").value).toBe(1);
    expectFrozenHeaderAndFilter(information, 2);

    const inventory = workbook.getWorksheet("재고현황")!;
    expect(rowValues(inventory, 1)).toEqual([
      undefined,
      "시약 코드",
      "시약명",
      "분류",
      "제조번호",
      "입고일",
      "유통기한",
      "초기 수량",
      "현재 수량",
      "안전 수량",
      "상태",
      "활성 여부",
      "메모"
    ]);
    expect(inventory.getCell("E2").type).toBe(ExcelJS.ValueType.Date);
    expect(inventory.getCell("F2").type).toBe(ExcelJS.ValueType.Date);
    expect(inventory.getCell("G2").type).toBe(ExcelJS.ValueType.Number);
    expect(inventory.getCell("G2").value).toBe(12);
    expect(inventory.getCell("H2").value).toBe(7);
    expect(inventory.getCell("K2").value).toBe("활성");
    expect(inventory.getCell("L2").type).toBe(ExcelJS.ValueType.String);
    expect(inventory.getCell("L2").value).toBe("=SUM(1,1)");
    expectFrozenHeaderAndFilter(inventory, 12);

    const movements = workbook.getWorksheet("입출고이력")!;
    expect(rowValues(movements, 1)).toEqual([
      undefined,
      "처리일시 (KST)",
      "구분",
      "시약 코드",
      "시약명",
      "제조번호",
      "유통기한",
      "기록 수량",
      "재고 증감",
      "사유",
      "참조 유형",
      "주문번호",
      "거래처",
      "처리자"
    ]);
    expect(movements.getCell("A2").type).toBe(ExcelJS.ValueType.Date);
    expect((movements.getCell("A2").value as Date).toISOString()).toBe("2026-07-13T00:30:45.000Z");
    expect(movements.getCell("A2").numFmt).toBe("yyyy-mm-dd hh:mm:ss");
    expect(movements.getCell("F2").type).toBe(ExcelJS.ValueType.Date);
    expect(movements.getCell("G2").type).toBe(ExcelJS.ValueType.Number);
    expect(movements.getCell("G2").value).toBe(5);
    expect(movements.getCell("H2").type).toBe(ExcelJS.ValueType.Number);
    expect(movements.getCell("H2").value).toBe(-5);
    expect(movements.getCell("I2").type).toBe(ExcelJS.ValueType.String);
    expect(movements.getCell("I2").value).toBe("@외부참조");
    expect(movements.getCell("K2").value).toBe("ORD-001");
    expect(movements.getCell("L2").value).toBe("테스트병원");
    expectFrozenHeaderAndFilter(movements, 13);

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => expect(cell.type).not.toBe(ExcelJS.ValueType.Formula));
      });
      expect(worksheet.getCell("A1").fill).toEqual(expect.objectContaining({
        pattern: "solid",
        fgColor: { argb: "FF2563EB" }
      }));
      expect(worksheet.getCell("A1").font).toEqual(expect.objectContaining({
        bold: true,
        color: { argb: "FFFFFFFF" }
      }));
    }
  });

  it("keeps an empty requested sheet with its header, filter, and frozen first row", async () => {
    const workbook = await loadWorkbook(await buildExportWorkbook({
      metadata: {
        generatedBy: "관리자",
        generatedAt: "2026-07-13T01:00:00.000Z"
      },
      inventory: []
    }));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["내보내기정보", "재고현황"]);
    const information = workbook.getWorksheet("내보내기정보")!;
    expect(information.getCell("A4").value).toBe("필터");
    expect(information.getCell("B4").value).toBe("전체");
    expect(information.getCell("A5").value).toBe("재고현황 건수");
    expect(information.getCell("B5").value).toBe(0);

    const inventory = workbook.getWorksheet("재고현황")!;
    expect(inventory.rowCount).toBe(1);
    expect(inventory.getCell("A2").value).toBeNull();
    expectFrozenHeaderAndFilter(inventory, 12);
  });

  it("creates an information plus movements workbook when movements are exported alone", async () => {
    const workbook = await loadWorkbook(await buildExportWorkbook({
      metadata: {
        generatedBy: "조회자",
        generatedAt: "2026-07-13T02:00:00.000Z"
      },
      movements: []
    }));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["내보내기정보", "입출고이력"]);
    expect(workbook.getWorksheet("입출고이력")!.rowCount).toBe(1);
    expect(workbook.getWorksheet("내보내기정보")!.getCell("B5").value).toBe(0);
  });
});
