import { describe, expect, it } from "vitest";
import { buildExportUrl, contentDispositionFileName } from "./export-download-button";

describe("export download helpers", () => {
  it("keeps selected filters and omits empty values from the export URL", () => {
    expect(buildExportUrl({
      report: "combined",
      datasets: "inventory,movements",
      inventoryQ: " 우유 ",
      movementQ: "",
      from: undefined
    })).toBe(
      "/api/exports?report=combined&datasets=inventory%2Cmovements&inventoryQ=+%EC%9A%B0%EC%9C%A0+"
    );
  });

  it("prefers and decodes the UTF-8 filename parameter", () => {
    expect(contentDispositionFileName(
      "attachment; filename=inventory.xlsx; filename*=UTF-8''%EC%9E%AC%EA%B3%A0%ED%98%84%ED%99%A9_20260713.xlsx",
      "fallback.xlsx"
    )).toBe("재고현황_20260713.xlsx");
  });

  it("sanitizes a plain response filename before browser download", () => {
    expect(contentDispositionFileName(
      'attachment; filename="../movement\\history.xlsx"',
      "fallback.xlsx"
    )).toBe("_movement_history.xlsx");
    expect(contentDispositionFileName(null, "fallback.xlsx")).toBe("fallback.xlsx");
  });
});
