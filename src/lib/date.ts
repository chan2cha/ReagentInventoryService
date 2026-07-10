const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function koreaDateKey(now = new Date()) {
  const korea = new Date(now.getTime() + KOREA_OFFSET_MS);
  const year = korea.getUTCFullYear();
  const month = String(korea.getUTCMonth() + 1).padStart(2, "0");
  const day = String(korea.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function koreaDatePrefix(now = new Date()) {
  return koreaDateKey(now).replaceAll("-", "");
}

export function formatKoreaDateTime(now = new Date()) {
  const korea = new Date(now.getTime() + KOREA_OFFSET_MS);
  const date = [
    korea.getUTCFullYear(),
    String(korea.getUTCMonth() + 1).padStart(2, "0"),
    String(korea.getUTCDate()).padStart(2, "0")
  ].join(".");
  const time = `${String(korea.getUTCHours()).padStart(2, "0")}:${String(korea.getUTCMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

export function koreaDayRange(now = new Date()) {
  const [year, month, day] = koreaDateKey(now).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - KOREA_OFFSET_MS);
  return { gte: start, lt: new Date(start.getTime() + DAY_MS) };
}

export function dateOnlyUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDateOnlyDays(dateKey: string, days: number) {
  return new Date(dateOnlyUtc(dateKey).getTime() + days * DAY_MS);
}

export function daysUntilDateOnly(target: Date | string, now = new Date()) {
  const targetKey = typeof target === "string" ? target.slice(0, 10) : target.toISOString().slice(0, 10);
  return Math.round((dateOnlyUtc(targetKey).getTime() - dateOnlyUtc(koreaDateKey(now)).getTime()) / DAY_MS);
}
