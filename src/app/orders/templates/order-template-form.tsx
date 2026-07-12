"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/app/submit-button";
import { ORDER_TEMPLATE_ITEM_MAX_COUNT } from "@/domain/order-template";
import { createOrderTemplate, updateOrderTemplate } from "./actions";

export type TemplateAllergenOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type TemplateItemValue = {
  allergenId: string;
  quantity: number;
};

export type OrderTemplateValue = {
  id: string;
  version: number;
  name: string;
  description: string;
  items: TemplateItemValue[];
};

type ItemRow = {
  rowId: string;
  allergenId: string;
  quantity: string;
};

function initialRows(template?: OrderTemplateValue): ItemRow[] {
  if (!template?.items.length) {
    return [{ rowId: "new-0", allergenId: "", quantity: "1" }];
  }

  return template.items.map((item, index) => ({
    allergenId: item.allergenId,
    quantity: String(item.quantity),
    rowId: `saved-${index}-${item.allergenId}`
  }));
}

export function OrderTemplateForm({
  allergens,
  template
}: {
  allergens: TemplateAllergenOption[];
  template?: OrderTemplateValue;
}) {
  const [rows, setRows] = useState<ItemRow[]>(() => initialRows(template));
  const nextRowId = useRef(1);
  const selectedIds = useMemo(
    () => new Set(rows.map((row) => row.allergenId).filter(Boolean)),
    [rows]
  );
  const activeAllergenCount = allergens.filter((allergen) => allergen.isActive).length;
  const selectedInactiveCount = rows.filter((row) =>
    allergens.some((allergen) => allergen.id === row.allergenId && !allergen.isActive)
  ).length;
  const hasActiveAllergens = activeAllergenCount > 0;
  const canSave = hasActiveAllergens && selectedInactiveCount === 0;
  const availableItemCount = Math.min(
    ORDER_TEMPLATE_ITEM_MAX_COUNT,
    activeAllergenCount + selectedInactiveCount
  );
  const canAddRow = rows.length < availableItemCount;

  function addRow() {
    setRows((current) => [
      ...current,
      { rowId: `new-${nextRowId.current++}`, allergenId: "", quantity: "1" }
    ]);
  }

  function removeRow(rowId: string) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.rowId !== rowId) : current);
  }

  function updateRow(rowId: string, patch: Partial<Omit<ItemRow, "rowId">>) {
    setRows((current) => current.map((row) => row.rowId === rowId ? { ...row, ...patch } : row));
  }

  return (
    <form
      action={template ? updateOrderTemplate : createOrderTemplate}
      className="entry-form template-entry-form"
    >
      {template ? (
        <>
          <input name="templateId" type="hidden" value={template.id} />
          <input name="expectedVersion" type="hidden" value={template.version} />
        </>
      ) : null}

      <label className="wide">
        세트명
        <input
          defaultValue={template?.name}
          maxLength={100}
          name="name"
          placeholder="예: 정기 검사 기본 세트"
          required
        />
      </label>

      <label className="wide">
        설명
        <textarea
          defaultValue={template?.description}
          maxLength={500}
          name="description"
          placeholder="담당자가 세트를 구분할 수 있는 설명을 입력하세요."
          rows={3}
        />
      </label>

      <div className="wide order-item-list template-item-editor">
        <div className="order-item-list-header">
          <strong>세트 품목과 기본 수량</strong>
          <button disabled={!canAddRow} onClick={addRow} type="button">
            <Plus aria-hidden="true" size={15} /> 품목 추가
          </button>
        </div>

        {rows.map((row, index) => (
          <div className="order-item-row" key={row.rowId}>
            <label>
              시약 {index + 1}
              <select
                name="allergenId"
                onChange={(event) => updateRow(row.rowId, { allergenId: event.target.value })}
                required
                value={row.allergenId}
              >
                <option value="">시약을 선택하세요</option>
                {allergens.map((allergen) => (
                  <option
                    disabled={
                      (selectedIds.has(allergen.id) && row.allergenId !== allergen.id) ||
                      (!allergen.isActive && row.allergenId !== allergen.id)
                    }
                    key={allergen.id}
                    value={allergen.id}
                  >
                    {allergen.code} · {allergen.name}{allergen.isActive ? "" : " (비활성 · 교체 필요)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              기본 수량
              <input
                max={2_147_483_647}
                min={1}
                name="quantity"
                onChange={(event) => updateRow(row.rowId, { quantity: event.target.value })}
                required
                step={1}
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
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        ))}
      </div>

      {!allergens.some((allergen) => allergen.isActive) ? (
        <p className="wide template-form-warning">활성 시약이 없어 주문 세트를 저장할 수 없습니다.</p>
      ) : null}
      {selectedInactiveCount > 0 ? (
        <p className="wide template-form-warning">
          비활성 시약 {selectedInactiveCount}종을 활성 시약으로 교체하거나 품목에서 제거하세요.
        </p>
      ) : null}

      <div className="form-actions">
        <SubmitButton
          className="primary-button"
          disabled={!canSave}
          pendingLabel={template ? "저장 중..." : "등록 중..."}
        >
          {template ? "변경사항 저장" : "주문 세트 등록"}
        </SubmitButton>
      </div>
    </form>
  );
}
