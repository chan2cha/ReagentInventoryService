import ExcelJS from "exceljs";
import { RECEIVING_IMPORT_HEADERS } from "@/domain/receiving-import";
import type { WarehouseOption } from "@/domain/warehouse";

type TemplateAllergen = {
  code: string;
  name: string;
};

export async function buildReceivingTemplate(
  allergens: readonly TemplateAllergen[],
  warehouses: readonly WarehouseOption[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Reagent Inventory Service";

  const sheet = workbook.addWorksheet("입고등록", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow([...RECEIVING_IMPORT_HEADERS]);
  sheet.columns = [
    { width: 18 }, { width: 24 }, { width: 12 }, { width: 20 },
    { width: 14 }, { width: 14 }, { width: 36 }
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

  const choices = workbook.addWorksheet("이름찾기", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  choices.columns = [
    { width: 28 }, { width: 18 }, { width: 28 }, { width: 20 }
  ];
  choices.addRow(["시약명", "시약코드", "창고명", "창고코드"]);
  const choiceRows = Math.max(allergens.length, warehouses.length);
  for (let index = 0; index < choiceRows; index += 1) {
    choices.addRow([
      allergens[index]?.name ?? "",
      allergens[index]?.code ?? "",
      warehouses[index]?.name ?? "",
      warehouses[index]?.code ?? ""
    ]);
  }
  choices.autoFilter = { from: "A1", to: `D${choiceRows + 1}` };
  choices.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  choices.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
  workbook.definedNames.add(`'이름찾기'!$A$2:$A$${allergens.length + 1}`, "AllergenNames");
  workbook.definedNames.add(`'이름찾기'!$C$2:$C$${warehouses.length + 1}`, "WarehouseNames");

  for (let row = 2; row <= 201; row += 1) {
    sheet.getCell(row, 1).dataValidation = {
      type: "list",
      formulae: ["AllergenNames"],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: "시약명 검색",
      prompt: "최신 Excel에서는 이름 일부를 입력하면 일치하는 항목만 표시됩니다.",
      showErrorMessage: true,
      errorTitle: "시약명 확인",
      error: "목록에 있는 시약명을 선택하세요."
    };
    sheet.getCell(row, 3).dataValidation = {
      type: "whole", operator: "greaterThanOrEqual", formulae: [1], allowBlank: true
    };
    sheet.getCell(row, 4).dataValidation = {
      type: "list",
      formulae: ["WarehouseNames"],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: "입고창고명 검색",
      prompt: "최신 Excel에서는 이름 일부를 입력하면 일치하는 항목만 표시됩니다.",
      showErrorMessage: true,
      errorTitle: "입고창고명 확인",
      error: "목록에 있는 입고창고명을 선택하세요."
    };
    sheet.getCell(row, 5).numFmt = "0000\-00\-00";
    sheet.getCell(row, 5).dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [19000101, 29991231],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: "입고일 입력",
      prompt: "예: 20260805를 입력하면 2026-08-05로 표시됩니다.",
      showErrorMessage: true,
      errorTitle: "입고일 확인",
      error: "입고일을 YYYYMMDD 8자리로 입력하세요."
    };
    sheet.getCell(row, 6).numFmt = "0000\-00\-00";
    sheet.getCell(row, 6).dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [19000101, 29991231],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: "유통기한 입력",
      prompt: "예: 20270805를 입력하면 2027-08-05로 표시됩니다.",
      showErrorMessage: true,
      errorTitle: "유통기한 확인",
      error: "유통기한을 YYYYMMDD 8자리로 입력하세요."
    };
  }
  sheet.autoFilter = { from: "A1", to: "G1" };

  const guide = workbook.addWorksheet("작성안내");
  guide.columns = [{ width: 22 }, { width: 72 }];
  guide.addRows([
    ["항목", "작성 방법"],
    ["시약명", "셀의 목록에서 현재 사용 중인 시약명을 선택"],
    ["제조번호", "동일 시약·제조번호·유통기한 조합은 중복 등록 불가"],
    ["입고수량", "1 이상의 정수"],
    ["입고창고명", "셀의 목록에서 현재 사용 중인 창고명을 선택"],
    ["이름 검색", "최신 Excel은 셀에 이름 일부를 입력하면 목록이 자동으로 좁혀짐"],
    ["구버전 검색", "이름찾기 시트의 열 제목 화살표를 누르고 검색한 뒤 이름을 복사"],
    ["입고일", "YYYYMMDD 8자리 입력 시 YYYY-MM-DD로 자동 표시"],
    ["유통기한", "YYYYMMDD 8자리 입력 시 YYYY-MM-DD로 자동 표시, 입고일 이후 날짜"],
    ["처리 방식", "한 행이라도 오류가 있으면 전체가 저장되지 않으며 최대 200건까지 등록"]
  ]);
  guide.getRow(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}
