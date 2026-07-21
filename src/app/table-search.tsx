import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { Route } from "next";
import Form from "next/form";
import { TableSearchResetLink } from "./table-search-reset-link";
import { TableSearchSubmit } from "./table-search-submit";

type TableSearchOption = {
  label: string;
  value: string;
};

type TableSearchSelectFilter = {
  kind?: "select";
  label: string;
  name: string;
  options: readonly TableSearchOption[];
  value?: string;
};

type TableSearchDateFilter = {
  kind: "date";
  label: string;
  max?: string;
  min?: string;
  name: string;
  value?: string;
};

type TableSearchFilter = TableSearchSelectFilter | TableSearchDateFilter;

type TableSearchProps = {
  description?: string;
  filter?: TableSearchFilter;
  filters?: readonly TableSearchFilter[];
  paramName?: string;
  pathname: Route;
  placeholder: string;
  preserve?: Record<string, string | undefined>;
  title?: string;
  value?: string;
};

export function TableSearch({
  description = "검색 조건을 조합해 원하는 항목만 확인하세요.",
  filter,
  filters,
  paramName = "q",
  pathname,
  placeholder,
  preserve = {},
  title = "목록 검색",
  value
}: TableSearchProps) {
  const query = value?.trim() ?? "";
  const normalizedFilters = filters ?? (filter ? [filter] : []);
  const filterCount = Number(Boolean(query)) + normalizedFilters.reduce(
    (count, item) => count + Number(Boolean(item.value?.trim())),
    0
  );
  const hasFilters = filterCount > 0;
  const isExpanded = normalizedFilters.length > 0;
  const hasMultipleFilters = normalizedFilters.length > 1;
  const resetQuery = new URLSearchParams();

  for (const [key, item] of Object.entries(preserve)) {
    if (item) resetQuery.set(key, item);
  }

  const resetHref = resetQuery.size ? `${pathname}?${resetQuery}` : pathname;
  const formStateKey = [
    `${paramName}:${query}`,
    ...normalizedFilters.map(
      (item) => `${item.name}:${item.value?.trim() ?? ""}`
    )
  ].join("\u0000");

  return (
    <Form
      action={pathname}
      aria-label={title}
      className={`table-search ${isExpanded ? "table-search-expanded" : "table-search-compact"}${hasMultipleFilters ? " table-search-multi-filter" : ""}`}
      key={formStateKey}
    >
      {Object.entries(preserve).map(([key, item]) => (
        item ? <input key={key} name={key} type="hidden" value={item} /> : null
      ))}

      {isExpanded ? (
        <div className="table-search-heading">
          <div className="table-search-title">
            <span className="table-search-title-icon">
              <SlidersHorizontal aria-hidden="true" size={17} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{hasFilters ? `${filterCount}개 조건이 적용되어 있습니다.` : description}</small>
            </span>
          </div>
          {hasFilters ? (
            <TableSearchResetLink className="table-search-reset" href={resetHref as never}>
              <RotateCcw aria-hidden="true" size={15} />
              <span>초기화</span>
            </TableSearchResetLink>
          ) : null}
        </div>
      ) : null}

      <div className="table-search-controls">
        <label className="table-search-field table-search-query">
          {isExpanded ? <span className="table-search-label">검색어</span> : null}
          <span className="table-search-input">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label={isExpanded ? undefined : placeholder}
              defaultValue={query}
              maxLength={200}
              name={paramName}
              placeholder={placeholder}
              type="search"
            />
          </span>
        </label>

        {normalizedFilters.map((item) => (
          <label className="table-search-field table-search-secondary" key={item.name}>
            <span className="table-search-label">{item.label}</span>
            {item.kind === "date" ? (
              <input
                defaultValue={item.value?.trim() ?? ""}
                max={item.max || undefined}
                min={item.min || undefined}
                name={item.name}
                type="date"
              />
            ) : (
              <select defaultValue={item.value?.trim() ?? ""} name={item.name}>
                {item.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </label>
        ))}

        <TableSearchSubmit />

        {!isExpanded && hasFilters ? (
          <TableSearchResetLink className="table-search-reset" href={resetHref as never}>
            <RotateCcw aria-hidden="true" size={15} />
            <span>초기화</span>
          </TableSearchResetLink>
        ) : null}
      </div>
    </Form>
  );
}
