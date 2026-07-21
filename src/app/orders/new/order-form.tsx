"use client";

/** 여러 주문 품목과 수량을 직접 편집하는 폼이다. */

import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ProgressLink } from "@/app/progress-link";
import { SearchableSelect, type SearchableSelectOption } from "@/app/searchable-select";
import { SubmitButton } from "../../submit-button";
import { createOrder } from "./actions";
import { OrderImageInput } from "./order-image-input";
import type { OrderFormAllergen, OrderFormClient } from "./order-form-data";

type OrderFormProps = {
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
};

type OrderFormRow = {
  rowId: number;
  allergenId: string;
  quantity: string;
};

const initialRows: OrderFormRow[] = [
  { rowId: 1, allergenId: "", quantity: "" }
];

export function OrderForm({ clients, allergens }: OrderFormProps) {
  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState(initialRows);
  const nextRowId = useRef(2);
  const canSubmit = clients.length > 0 && allergens.length > 0;
  const selectedIds = useMemo(() => new Set(rows.map((row) => row.allergenId).filter(Boolean)), [rows]);
  const clientOptions = useMemo<SearchableSelectOption[]>(() => clients.map((client) => ({
    id: client.id,
    label: client.name,
    description: [client.region, client.deliveryDepartment, `담당 ${client.manager}`].filter(Boolean).join(" · "),
    keywords: [client.name, client.region ?? "", client.manager, client.deliveryDepartment ?? ""]
  })), [clients]);
  const allergenOptions = useMemo<SearchableSelectOption[]>(() => allergens.map((allergen) => ({
    id: allergen.id,
    label: `${allergen.code} · ${allergen.name}`,
    keywords: [allergen.code, allergen.name]
  })), [allergens]);

  function addRow() {
    setRows((current) => [
      ...current,
      { rowId: nextRowId.current++, allergenId: "", quantity: "" }
    ]);
  }

  function removeRow(rowId: number) {
    setRows((current) => current.length > 1
      ? current.filter((row) => row.rowId !== rowId)
      : current);
  }

  function updateAllergen(rowId: number, allergenId: string) {
    setRows((current) => current.map((row) => row.rowId === rowId
      ? { ...row, allergenId }
      : row));
  }

  function updateQuantity(rowId: number, quantity: string) {
    setRows((current) => current.map((row) => row.rowId === rowId
      ? { ...row, quantity }
      : row));
  }

  return (
    <form action={createOrder} className="entry-form order-entry-form">
      <SearchableSelect
        className="wide"
        disabled={!canSubmit}
        label="거래처"
        name="clientId"
        onChange={setClientId}
        options={clientOptions}
        placeholder="거래처명, 지역, 담당자, 납품과 검색"
        required
        value={clientId}
      />

      <div className="wide order-item-list">
        <div className="order-item-list-header">
          <strong>주문 품목</strong>
          <button disabled={!canSubmit || rows.length >= allergens.length} onClick={addRow} type="button">
            품목 추가
          </button>
        </div>

        {rows.map((row, index) => (
          <div className="order-item-row" key={row.rowId}>
            <SearchableSelect
              disabled={!canSubmit}
              excludedIds={Array.from(selectedIds).filter((id) => id !== row.allergenId)}
              label="시약명"
              name="allergenId"
              onChange={(allergenId) => updateAllergen(row.rowId, allergenId)}
              options={allergenOptions}
              placeholder="시약 코드 또는 시약명 검색"
              required
              value={row.allergenId}
            />
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
          </div>
        ))}
      </div>

      <OrderImageInput />

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
