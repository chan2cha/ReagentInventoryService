import { describe, expect, it } from "vitest";
import { daysUntilDateOnly, formatKoreaDateTime, koreaDateKey, koreaDatePrefix, koreaDayRange } from "./date";

describe("Korea date utilities", () => {
  it("changes date at Korean midnight", () => {
    expect(koreaDateKey(new Date("2026-07-09T14:59:59.999Z"))).toBe("2026-07-09");
    expect(koreaDateKey(new Date("2026-07-09T15:00:00.000Z"))).toBe("2026-07-10");
    expect(koreaDatePrefix(new Date("2026-07-09T15:00:00.000Z"))).toBe("20260710");
  });

  it("returns the UTC range for one Korean calendar day", () => {
    const range = koreaDayRange(new Date("2026-07-10T03:00:00.000Z"));
    expect(range.gte.toISOString()).toBe("2026-07-09T15:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-07-10T15:00:00.000Z");
  });

  it("formats a database retrieval time in Korean local time", () => {
    expect(formatKoreaDateTime(new Date("2026-07-10T05:23:00.000Z"))).toBe("2026.07.10 14:23");
  });

  it("compares date-only expiration values against the Korean date", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");
    expect(daysUntilDateOnly("2026-07-10", now)).toBe(0);
    expect(daysUntilDateOnly("2026-07-11", now)).toBe(1);
  });
});
