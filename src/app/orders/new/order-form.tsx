"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ProgressLink } from "@/app/progress-link";
import {
  changeOrderDraftRowAllergen,
  changeOrderDraftRowQuantity,
  detachOrderTemplateFromDraft,
  getOrderTemplateDraftState,
  reapplyOrderTemplateToDraft,
  selectOrderTemplateInDraft,
  type OrderDraftRow
} from "@/domain/order-draft";
import { matchesOrderTemplateQuery } from "@/domain/order-template-picker";
import { SubmitButton } from "../../submit-button";
import { createOrder } from "./actions";
import type { OrderFormAllergen, OrderFormClient, OrderFormTemplate } from "./order-form-data";

type OrderFormProps = {
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
  templates: OrderFormTemplate[];
  templateLoadFailed: boolean;
};

const initialDraft: {
  rows: OrderDraftRow[];
  selectedTemplateId: string | null;
  templateAnnouncement: string;
} = {
  rows: [{ rowId: 1, allergenId: "", quantity: "", source: "MANUAL" }],
  selectedTemplateId: null,
  templateAnnouncement: ""
};
const TEMPLATE_PAGE_SIZE = 6;

export function OrderForm({ clients, allergens, templates, templateLoadFailed }: OrderFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [templateQuery, setTemplateQuery] = useState("");
  const [showSelectedTemplateOnly, setShowSelectedTemplateOnly] = useState(false);
  const [visibleTemplateLimit, setVisibleTemplateLimit] = useState(TEMPLATE_PAGE_SIZE);
  const nextRowId = useRef(2);
  const templateSearchRef = useRef<HTMLInputElement>(null);
  const canSubmit = clients.length > 0 && allergens.length > 0;
  const activeAllergenIds = useMemo(() => new Set(allergens.map((allergen) => allergen.id)), [allergens]);
  const { rows, selectedTemplateId, templateAnnouncement } = draft;
  const selectedIds = useMemo(() => new Set(rows.map((row) => row.allergenId).filter(Boolean)), [rows]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );
  const selectedTemplateState = selectedTemplate
    ? getOrderTemplateDraftState(rows, selectedTemplate.id, selectedTemplate.items)
    : null;
  const matchingTemplates = useMemo(() => {
    const matches = templates.filter((template) => matchesOrderTemplateQuery(template, templateQuery));

    if (!selectedTemplateId) {
      return matches;
    }

    const selectedIndex = matches.findIndex((template) => template.id === selectedTemplateId);

    if (selectedIndex <= 0) {
      return matches;
    }

    return [matches[selectedIndex], ...matches.slice(0, selectedIndex), ...matches.slice(selectedIndex + 1)];
  }, [selectedTemplateId, templateQuery, templates]);
  const filteredTemplates = showSelectedTemplateOnly
    ? matchingTemplates.filter((template) => template.id === selectedTemplateId)
    : matchingTemplates;
  const visibleTemplates = filteredTemplates.slice(0, visibleTemplateLimit);

  function createRowId() {
    return nextRowId.current++;
  }

  function addRow() {
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        { rowId: createRowId(), allergenId: "", quantity: "", source: "MANUAL" }
      ]
    }));
  }

  function removeRow(rowId: number) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.length > 1 ? current.rows.filter((row) => row.rowId !== rowId) : current.rows
    }));
  }

  function updateAllergen(rowId: number, allergenId: string) {
    setDraft((current) => ({
      ...current,
      rows: changeOrderDraftRowAllergen(current.rows, rowId, allergenId)
    }));
  }

  function updateQuantity(rowId: number, quantity: string) {
    setDraft((current) => ({
      ...current,
      rows: changeOrderDraftRowQuantity(current.rows, rowId, quantity)
    }));
  }

  function templateCanBeApplied(template: OrderFormTemplate) {
    return template.items.length > 0 && template.items.every(
      (item) => item.allergen.isActive && activeAllergenIds.has(item.allergenId)
    );
  }

  function selectTemplate(template: OrderFormTemplate) {
    if (!templateCanBeApplied(template)) {
      setDraft((current) => ({
        ...current,
        templateAnnouncement: `‘${template.name}’ 세트를 적용할 수 없습니다. 세트 구성을 확인하세요.`
      }));
      return;
    }

    setDraft((current) => {
      if (current.selectedTemplateId !== null) return current;

      const nextRows = selectOrderTemplateInDraft(current.rows, template.id, template.items, createRowId);
      const nextState = getOrderTemplateDraftState(nextRows, template.id, template.items);

      return {
        rows: nextRows,
        selectedTemplateId: template.id,
        templateAnnouncement: nextState === "modified"
          ? `‘${template.name}’ 세트를 기준으로 선택했습니다. 기존 개별 품목의 수량은 유지되어 구성이 수정된 상태입니다.`
          : `‘${template.name}’ 세트를 기준으로 선택하고 ${template.items.length}개 품목을 반영했습니다.`
      };
    });
  }

  function resetSelectedTemplate(template: OrderFormTemplate) {
    if (
      selectedTemplateState === "modified" &&
      !window.confirm(
        `‘${template.name}’ 기준 세트에서 수정한 품목과 수량을 기본값으로 복원할까요?\n개별 추가 품목은 유지됩니다.`
      )
    ) {
      return;
    }

    setDraft((current) => current.selectedTemplateId === template.id ? {
      rows: reapplyOrderTemplateToDraft(current.rows, template.id, template.items, createRowId),
      selectedTemplateId: template.id,
      templateAnnouncement:
        `‘${template.name}’ 기준 세트의 기본 품목과 수량을 복원했습니다. 개별 추가 품목은 유지됩니다.`
    } : current);
  }

  function changeSelectedTemplate(template: OrderFormTemplate) {
    if (!templateCanBeApplied(template)) {
      setDraft((current) => ({
        ...current,
        templateAnnouncement: `‘${template.name}’ 세트를 적용할 수 없습니다. 세트 구성을 확인하세요.`
      }));
      return;
    }

    const expectedTemplateId = selectedTemplateId;
    if (!expectedTemplateId || expectedTemplateId === template.id) return;

    const shouldChange = window.confirm(
      `‘${template.name}’ 세트로 기준을 변경할까요?\n기존 기준 세트 품목은 교체되고 개별 추가 품목은 유지됩니다.`
    );

    if (!shouldChange) {
      return;
    }

    setDraft((current) => {
      if (current.selectedTemplateId !== expectedTemplateId) return current;

      const nextRows = selectOrderTemplateInDraft(current.rows, template.id, template.items, createRowId);
      const nextState = getOrderTemplateDraftState(nextRows, template.id, template.items);

      return {
        rows: nextRows,
        selectedTemplateId: template.id,
        templateAnnouncement: nextState === "modified"
          ? `기준 세트를 ‘${template.name}’ 세트로 변경했습니다. 기존 개별 품목의 수량은 유지되어 구성이 수정된 상태입니다.`
          : `기준 세트를 ‘${template.name}’ 세트로 변경했습니다. 개별 추가 품목은 유지됩니다.`
      };
    });
  }

  function detachSelectedTemplate(template: OrderFormTemplate) {
    setDraft((current) => current.selectedTemplateId === template.id ? {
      rows: detachOrderTemplateFromDraft(current.rows),
      selectedTemplateId: null,
      templateAnnouncement: `‘${template.name}’ 기준 세트를 해제했습니다. 현재 주문 품목과 수량은 유지됩니다.`
    } : current);
  }

  function updateTemplateQuery(query: string) {
    setTemplateQuery(query);
    setVisibleTemplateLimit(TEMPLATE_PAGE_SIZE);
  }

  function clearTemplateQuery() {
    updateTemplateQuery("");
    templateSearchRef.current?.focus();
  }

  function toggleSelectedTemplateOnly(checked: boolean) {
    setShowSelectedTemplateOnly(checked);
    setVisibleTemplateLimit(TEMPLATE_PAGE_SIZE);
  }

  return (
    <form action={createOrder} className="entry-form order-entry-form">
      <label className="wide">
        거래처
        <select disabled={!canSubmit} name="clientId" required>
          <option value="">거래처를 선택하세요</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} · {client.manager}
            </option>
          ))}
        </select>
      </label>

      <section aria-labelledby="order-template-heading" className="wide order-template-picker">
        <div className="order-template-picker-header">
          <div>
            <strong id="order-template-heading">자주 쓰는 주문 세트</strong>
            <p>기준 세트는 하나만 선택할 수 있으며, 품목과 수량은 자유롭게 수정할 수 있습니다.</p>
          </div>
          <ProgressLink className="order-template-manage-link" href={"/orders/templates" as never}>
            세트 관리
          </ProgressLink>
        </div>

        {templateLoadFailed ? (
          <p className="order-template-warning" role="status">
            주문 세트를 불러오지 못했습니다. 아래에서 품목을 직접 입력해 주문할 수 있습니다.
          </p>
        ) : templates.length === 0 ? (
          <p className="order-template-empty">등록된 주문 세트가 없습니다.</p>
        ) : (
          <>
            <div className="order-template-toolbar">
              <div className="order-template-search">
                <label htmlFor="order-template-search-input">세트 검색</label>
                <div className="order-template-search-control">
                  <input
                    aria-controls="order-template-results"
                    id="order-template-search-input"
                    onChange={(event) => updateTemplateQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                    placeholder="세트명, 설명, 시약 코드·이름 검색"
                    ref={templateSearchRef}
                    type="search"
                    value={templateQuery}
                  />
                  {templateQuery ? (
                    <button aria-label="세트 검색어 지우기" onClick={clearTemplateQuery} type="button">
                      지우기
                    </button>
                  ) : null}
                </div>
              </div>
              <label className="order-template-selected-filter">
                <input
                  checked={showSelectedTemplateOnly}
                  onChange={(event) => toggleSelectedTemplateOnly(event.target.checked)}
                  type="checkbox"
                />
                <span>선택된 세트만</span>
              </label>
            </div>

            <dl aria-label="주문 세트 개수" aria-live="polite" className="order-template-counts">
              <div>
                <dt>전체</dt>
                <dd>{templates.length}</dd>
              </div>
              <div>
                <dt>검색</dt>
                <dd>{matchingTemplates.length}</dd>
              </div>
              <div>
                <dt>선택</dt>
                <dd>{selectedTemplate ? 1 : 0}/1</dd>
              </div>
            </dl>

            {selectedTemplate ? (
              <div className={`order-template-current${selectedTemplateState === "modified" ? " is-modified" : ""}`}>
                <p>
                  <span>현재 기준 세트</span>
                  <strong>{selectedTemplate.name}</strong>
                  <em>{selectedTemplateState === "modified" ? "구성 수정됨" : "선택됨"}</em>
                </p>
                <div className="order-template-current-actions">
                  <button onClick={() => resetSelectedTemplate(selectedTemplate)} type="button">
                    기본값 복원
                  </button>
                  <button
                    className="order-template-detach-button"
                    onClick={() => detachSelectedTemplate(selectedTemplate)}
                    type="button"
                  >
                    세트 해제(품목 유지)
                  </button>
                </div>
              </div>
            ) : null}

            {filteredTemplates.length === 0 ? (
              <div className="order-template-filter-empty" id="order-template-results" role="status">
                <strong>검색 결과가 없습니다.</strong>
                <p>검색어나 ‘선택된 세트만’ 조건을 바꿔 보세요.</p>
                <button
                  onClick={() => {
                    clearTemplateQuery();
                    setShowSelectedTemplateOnly(false);
                  }}
                  type="button"
                >
                  검색 조건 초기화
                </button>
              </div>
            ) : (
              <div className="order-template-list" id="order-template-results">
                {visibleTemplates.map((template) => {
                  const isSelected = template.id === selectedTemplateId;
                  const isModified = isSelected && selectedTemplateState === "modified";
                  const canApply = templateCanBeApplied(template);
                  const totalQuantity = template.items.reduce((total, item) => total + item.quantity, 0);
                  const preview = template.items
                    .slice(0, 3)
                    .map((item) => `${item.allergen.code} ${item.quantity}개`)
                    .join(" · ");

                  return (
                    <article
                      className={`order-template-card${isSelected ? " is-selected" : ""}${isModified ? " is-modified" : ""}`}
                      key={template.id}
                    >
                      <div className="order-template-card-copy">
                        <div className="order-template-card-title">
                          <strong>{template.name}</strong>
                          {isSelected ? (
                            <span className="order-template-selection-badge">
                              기준 세트 · {isModified ? "구성 수정됨" : "선택됨"}
                            </span>
                          ) : null}
                        </div>
                        <span>{template.items.length}종 · 총 {totalQuantity}개</span>
                        {template.description ? <p>{template.description}</p> : null}
                        <small>{preview}{template.items.length > 3 ? ` 외 ${template.items.length - 3}종` : ""}</small>
                        {!canApply ? <em>비활성 시약이 포함되어 적용할 수 없습니다.</em> : null}
                      </div>
                      <div className="order-template-card-actions">
                        {isSelected ? (
                          <>
                            <button
                              aria-label={`${template.name} 기준 세트 기본값 복원`}
                              onClick={() => resetSelectedTemplate(template)}
                              type="button"
                            >
                              기본값 복원
                            </button>
                            <button
                              aria-label={`${template.name} 기준 세트 해제, 품목 유지`}
                              className="order-template-detach-button"
                              onClick={() => detachSelectedTemplate(template)}
                              type="button"
                            >
                              세트 해제(품목 유지)
                            </button>
                          </>
                        ) : (
                          <button
                            aria-label={`${template.name} ${selectedTemplateId ? "기준 세트로 변경" : "기준 세트 선택"}`}
                            disabled={!canApply}
                            onClick={() => selectedTemplateId ? changeSelectedTemplate(template) : selectTemplate(template)}
                            type="button"
                          >
                            {selectedTemplateId ? "이 세트로 변경" : "기준 세트 선택"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {filteredTemplates.length > TEMPLATE_PAGE_SIZE ? (
              <div className="order-template-pagination">
                <span>{visibleTemplates.length} / {filteredTemplates.length}개 표시</span>
                <div>
                  {visibleTemplates.length < filteredTemplates.length ? (
                    <button
                      aria-controls="order-template-results"
                      onClick={() => setVisibleTemplateLimit((current) => current + TEMPLATE_PAGE_SIZE)}
                      type="button"
                    >
                      더 보기
                    </button>
                  ) : null}
                  {visibleTemplates.length > TEMPLATE_PAGE_SIZE ? (
                    <button
                      aria-controls="order-template-results"
                      onClick={() => setVisibleTemplateLimit(TEMPLATE_PAGE_SIZE)}
                      type="button"
                    >
                      접기
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}

        <p aria-live="polite" className="order-template-announcement" role="status">
          {templateAnnouncement}
        </p>
      </section>

      <div className="wide order-item-list">
        <div className="order-item-list-header">
          <strong>주문 품목</strong>
          <button disabled={!canSubmit || rows.length >= allergens.length} onClick={addRow} type="button">
            품목 추가
          </button>
        </div>

        {rows.map((row, index) => {
          const isTemplateRow = row.source === "TEMPLATE" && row.templateId === selectedTemplateId;
          const sourceLabel = isTemplateRow
            ? row.hasManualOrigin
              ? "개별 유지 · 세트 포함"
              : "기준 세트"
            : "개별 추가";
          const sourceClassName = isTemplateRow
            ? row.hasManualOrigin
              ? "mixed"
              : "template"
            : "manual";

          return <div className="order-item-row" key={row.rowId}>
            <label>
              <span className="order-item-field-label">
                시약명
                <em className={`order-item-source-badge ${sourceClassName}`}>{sourceLabel}</em>
              </span>
              <select
                disabled={!canSubmit}
                name="allergenId"
                onChange={(event) => updateAllergen(row.rowId, event.target.value)}
                required
                value={row.allergenId}
              >
                <option value="">시약을 선택하세요</option>
                {allergens.map((allergen) => (
                  <option
                    disabled={selectedIds.has(allergen.id) && row.allergenId !== allergen.id}
                    key={allergen.id}
                    value={allergen.id}
                  >
                    {allergen.code} · {allergen.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              주문 수량
              <input
                disabled={!canSubmit}
                inputMode="numeric"
                max="2147483647"
                min="1"
                name="quantity"
                onChange={(event) => updateQuantity(row.rowId, event.target.value)}
                placeholder="0"
                required
                step="1"
                type="number"
                value={row.quantity}
              />
            </label>
            <button
              aria-label={`${index + 1}번째 품목 삭제`}
              className="row-icon-button"
              disabled={rows.length === 1}
              onClick={() => removeRow(row.rowId)}
              title="품목 삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>;
        })}
      </div>

      <label className="wide">
        메모
        <textarea name="memo" placeholder="주문 메모를 입력하세요" rows={4} />
      </label>
      <div className="form-actions">
        <ProgressLink className="secondary-button" href={"/orders" as never}>
          취소
        </ProgressLink>
        <SubmitButton className="primary-button" disabled={!canSubmit} pendingLabel="저장 중...">
          주문 저장
        </SubmitButton>
      </div>
    </form>
  );
}
