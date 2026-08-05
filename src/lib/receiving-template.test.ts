import ExcelJS from "exceljs";
import { buildReceivingTemplate } from "./receiving-template";

describe("buildReceivingTemplate", () => {
  it("adds current allergen and warehouse names as named dropdown lists", async () => {
    const data = await buildReceivingTemplate(
      [{ code: "R-001", name: "계란" }, { code: "R-002", name: "우유" }],
      [{ code: "FINISHED_GOODS", name: "완제품" }, { code: "SAMPLE", name: "검체" }]
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);

    const receiving = workbook.getWorksheet("입고등록")!;
    const choices = workbook.getWorksheet("이름찾기")!;
    expect(choices.state).toBe("visible");
    expect(choices.getCell("A2").value).toBe("계란");
    expect(choices.getCell("A3").value).toBe("우유");
    expect(choices.getCell("C2").value).toBe("완제품");
    expect(choices.getCell("C3").value).toBe("검체");
    expect(workbook.definedNames.getRanges("AllergenNames").ranges)
      .toContain("'이름찾기'!$A$2:$A$3");
    expect(workbook.definedNames.getRanges("WarehouseNames").ranges)
      .toContain("'이름찾기'!$C$2:$C$3");
    expect(receiving.getCell("A2").dataValidation.formulae).toEqual(["AllergenNames"]);
    expect(receiving.getCell("D2").dataValidation.formulae).toEqual(["WarehouseNames"]);
    expect(receiving.getCell("A2").dataValidation.allowBlank).toBe(true);
    expect(receiving.getCell("C2").dataValidation.allowBlank).toBe(true);
    expect(receiving.getCell("D2").dataValidation.allowBlank).toBe(true);
    expect(receiving.getCell("A2").dataValidation.showInputMessage).toBe(true);
    expect(receiving.getCell("D2").dataValidation.showInputMessage).toBe(true);
    expect(receiving.getCell("E2").numFmt).toBe("0000\-00\-00");
    expect(receiving.getCell("E2").dataValidation.allowBlank).toBe(true);
    expect(receiving.getCell("E2").dataValidation.formulae).toEqual([19000101, 29991231]);
    expect(receiving.getCell("F2").numFmt).toBe("0000\-00\-00");
    expect(receiving.getCell("F2").dataValidation.allowBlank).toBe(true);
    expect(receiving.getCell("F2").dataValidation.formulae).toEqual([19000101, 29991231]);
    expect(choices.autoFilter).toBe("A1:D3");
  });
});
