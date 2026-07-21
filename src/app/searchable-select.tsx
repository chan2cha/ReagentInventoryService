"use client";

import { Check, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
};

type SearchableSelectProps = {
  className?: string;
  disabled?: boolean;
  excludedIds?: readonly string[];
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  placeholder: string;
  required?: boolean;
  value: string;
};

const DEFAULT_RESULT_LIMIT = 8;

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

export function filterSearchableOptions(
  options: readonly SearchableSelectOption[],
  query: string,
  excludedIds: readonly string[] = [],
  limit = DEFAULT_RESULT_LIMIT
) {
  const excluded = new Set(excludedIds);
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);

  return options
    .filter((option) => {
      if (excluded.has(option.id)) return false;

      const searchableText = normalizeSearchText([
        option.label,
        option.description,
        ...(option.keywords ?? [])
      ].filter(Boolean).join(" "));

      return terms.every((term) => searchableText.includes(term));
    })
    .slice(0, Math.max(0, limit));
}

export function SearchableSelect({
  className,
  disabled = false,
  excludedIds = [],
  label,
  name,
  onChange,
  options,
  placeholder,
  required = false,
  value
}: SearchableSelectProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const helpId = `${generatedId}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [validationMessage, setValidationMessage] = useState("");
  const filteredOptions = useMemo(
    () => filterSearchableOptions(options, query, excludedIds),
    [excludedIds, options, query]
  );
  const activeOption = filteredOptions[Math.min(activeIndex, Math.max(filteredOptions.length - 1, 0))] ?? null;
  const invalidSelectionMessage = `${label} 검색 결과에서 항목을 선택하세요.`;

  function setInputValidity(message: string) {
    inputRef.current?.setCustomValidity(message);
    setValidationMessage(message);
  }

  function selectOption(option: SearchableSelectOption) {
    setQuery(option.label);
    onChange(option.id);
    setInputValidity("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function clearSelection() {
    setQuery("");
    onChange("");
    setInputValidity("");
    setOpen(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  return (
    <div className={["searchable-select-field", className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId}>{label}</label>
      <div
        className="searchable-select"
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setOpen(false);
          if (!value && query.trim()) setInputValidity(invalidSelectionMessage);
        }}
      >
        <div className="searchable-select-control">
          <Search aria-hidden="true" size={17} />
          <input
            aria-activedescendant={open && activeOption ? `${listboxId}-${activeOption.id}` : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-describedby={helpId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={validationMessage ? true : undefined}
            autoComplete="off"
            className="searchable-select-input"
            disabled={disabled}
            id={inputId}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setOpen(true);
              setActiveIndex(-1);
              if (value) onChange("");
              setInputValidity(nextQuery.trim() ? invalidSelectionMessage : "");
            }}
            onFocus={() => setOpen(true)}
            onInvalid={(event) => {
              if (!value) {
                event.currentTarget.setCustomValidity(invalidSelectionMessage);
                setValidationMessage(invalidSelectionMessage);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) => filteredOptions.length
                  ? Math.min(current + 1, filteredOptions.length - 1)
                  : 0);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) => filteredOptions.length
                  ? current > 0 ? current - 1 : filteredOptions.length - 1
                  : 0);
              } else if (event.key === "Enter" && open && activeOption) {
                event.preventDefault();
                selectOption(activeOption);
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            ref={inputRef}
            required={required}
            role="combobox"
            type="text"
            inputMode="search"
            value={query}
          />
          {query ? (
            <button
              aria-label={`${label} 선택 지우기`}
              className="searchable-select-clear"
              disabled={disabled}
              onClick={clearSelection}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>

        {open && !disabled ? (
          <div className="searchable-select-options" id={listboxId} role="listbox">
            {filteredOptions.length ? filteredOptions.map((option, index) => (
              <button
                aria-selected={option.id === value}
                className={index === activeIndex ? "is-active" : undefined}
                id={`${listboxId}-${option.id}`}
                key={option.id}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => event.preventDefault()}
                role="option"
                tabIndex={-1}
                type="button"
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {option.id === value ? <Check aria-hidden="true" size={16} /> : null}
              </button>
            )) : (
              <p className="searchable-select-empty" role="status">검색 결과가 없습니다.</p>
            )}
          </div>
        ) : null}

        <input disabled={disabled} name={name} type="hidden" value={value} />
        <small className="visually-hidden" id={helpId}>
          검색한 뒤 목록에서 선택하세요.
        </small>
        {validationMessage ? <small className="searchable-select-error" role="alert">{validationMessage}</small> : null}
      </div>
    </div>
  );
}
