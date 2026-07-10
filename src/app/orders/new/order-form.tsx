"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createOrder } from "./actions";
import type { OrderFormAllergen, OrderFormClient } from "./order-form-data";

type OrderFormProps = {
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
};

type ItemRow = {
  id: number;
  allergenId: string;
};

let nextRowId = 2;

export function OrderForm({ clients, allergens }: OrderFormProps) {
  const [rows, setRows] = useState<ItemRow[]>([{ id: 1, allergenId: "" }]);
  const canSubmit = clients.length > 0 && allergens.length > 0;
  const selectedIds = useMemo(() => new Set(rows.map((row) => row.allergenId).filter(Boolean)), [rows]);

  function addRow() {
    setRows((current) => [...current, { id: nextRowId++, allergenId: "" }]);
  }

  function removeRow(id: number) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);
  }

  function updateAllergen(id: number, allergenId: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, allergenId } : row));
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

      <div className="wide order-item-list">
        <div className="order-item-list-header">
          <strong>주문 품목</strong>
          <button disabled={!canSubmit || rows.length >= allergens.length} onClick={addRow} type="button">
            품목 추가
          </button>
        </div>

        {rows.map((row, index) => (
          <div className="order-item-row" key={row.id}>
            <label>
              시약명
              <select
                disabled={!canSubmit}
                name="allergenId"
                onChange={(event) => updateAllergen(row.id, event.target.value)}
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
              <input disabled={!canSubmit} min="1" name="quantity" placeholder="0" required type="number" />
            </label>
            <button
              className="row-icon-button"
              disabled={rows.length === 1}
              onClick={() => removeRow(row.id)}
              title="품목 삭제"
              type="button"
            >
              {index + 1}
            </button>
          </div>
        ))}
      </div>

      <label className="wide">
        메모
        <textarea name="memo" placeholder="주문 메모를 입력하세요" rows={4} />
      </label>
      <div className="form-actions">
        <Link className="secondary-button" href={"/orders" as never}>
          취소
        </Link>
        <button className="primary-button" disabled={!canSubmit} type="submit">
          주문 저장
        </button>
      </div>
    </form>
  );
}
