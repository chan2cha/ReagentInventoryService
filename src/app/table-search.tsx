import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

type TableSearchOption = {
  label: string;
  value: string;
};

type TableSearchFilter = {
  label: string;
  name: string;
  options: readonly TableSearchOption[];
  value?: string;
};

type TableSearchProps = {
  description?: string;
  filter?: TableSearchFilter;
  paramName?: string;
  pathname: string;
  placeholder: string;
  preserve?: Record<string, string | undefined>;
  title?: string;
  value?: string;
};

export function TableSearch({
  description = "검색 조건을 조합해 원하는 항목만 확인하세요.",
  filter,
  paramName = "q",
  pathname,
  placeholder,
  preserve = {},
  title = "목록 검색",
  value
}: TableSearchProps) {
  const query = value?.trim() ?? "";
  const filterValue = filter?.value?.trim() ?? "";
  const filterCount = Number(Boolean(query)) + Number(Boolean(filterValue));
  const hasFilters = filterCount > 0;
  const isExpanded = Boolean(filter);
  const resetQuery = new URLSearchParams();

  for (const [key, item] of Object.entries(preserve)) {
    if (item) resetQuery.set(key, item);
  }

  const resetHref = resetQuery.size ? `${pathname}?${resetQuery}` : pathname;

  return (
    <form
      action={pathname}
      aria-label={title}
      className={`table-search ${isExpanded ? "table-search-expanded" : "table-search-compact"}`}
      method="get"
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
            <Link className="table-search-reset" href={resetHref as never}>
              <RotateCcw aria-hidden="true" size={15} />
              <span>초기화</span>
            </Link>
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

        {filter ? (
          <label className="table-search-field table-search-secondary">
            <span className="table-search-label">{filter.label}</span>
            <select defaultValue={filterValue} name={filter.name}>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <button className="table-search-submit" type="submit">
          <Search aria-hidden="true" size={16} />
          <span>검색</span>
        </button>

        {!isExpanded && hasFilters ? (
          <Link className="table-search-reset" href={resetHref as never}>
            <RotateCcw aria-hidden="true" size={15} />
            <span>초기화</span>
          </Link>
        ) : null}
      </div>
    </form>
  );
}
