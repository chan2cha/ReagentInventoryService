export const PAGE_SIZE = 20;
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number; skip: number };
export type PaginatedResult<T> = PageMeta & { rows: T[] };
export function parsePage(value?: string) { const page = Number.parseInt(value ?? "1", 10); return Number.isInteger(page) && page > 0 ? page : 1; }
export function pageMeta(requested: number, total: number): PageMeta { const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE)); const page = Math.min(Math.max(1, requested), totalPages); return { page, pageSize: PAGE_SIZE, total, totalPages, skip: (page - 1) * PAGE_SIZE }; }
export function paginateRows<T>(rows: T[], requested: number): PaginatedResult<T> { const meta = pageMeta(requested, rows.length); return { ...meta, rows: rows.slice(meta.skip, meta.skip + PAGE_SIZE) }; }
