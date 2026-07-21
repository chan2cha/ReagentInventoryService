"use client";

import {
  ArrowRight,
  ArrowRightLeft,
  Minus,
  PackageMinus,
  PackagePlus
} from "lucide-react";
import { useId, useState } from "react";
import {
  WAREHOUSE_KINDS,
  warehouseLabel,
  type WarehouseKind
} from "@/domain/warehouse";
import { DialogFrame } from "../dialog-frame";
import { SubmitButton } from "../submit-button";
import { adjustLotStock, transferLotWarehouse } from "./actions";

type ManagementMode = "ADJUST" | "TRANSFER";
type AdjustmentOperation = "ADD" | "REMOVE" | "DISPOSE";

type InventoryManagementDialogProps = {
  allergenCode: string;
  allergenName: string;
  currentQuantity: number;
  disabled: boolean;
  expirationDate: string;
  lotId: string;
  lotNo: string;
  minStock: number | null;
  warehouse: WarehouseKind;
};

const operationDetails = {
  ADD: {
    label: "수량 추가",
    icon: PackagePlus,
    button: "추가",
    reason: "실사 결과 증가"
  },
  REMOVE: {
    label: "수량 차감",
    icon: Minus,
    button: "차감",
    reason: "실사 결과 감소"
  },
  DISPOSE: {
    label: "폐기",
    icon: PackageMinus,
    button: "폐기",
    reason: "유효기간 만료"
  }
} satisfies Record<
  AdjustmentOperation,
  { label: string; icon: typeof PackagePlus; button: string; reason: string }
>;

export function InventoryManagementDialog({
  allergenCode,
  allergenName,
  currentQuantity,
  disabled,
  expirationDate,
  lotId,
  lotNo,
  minStock,
  warehouse
}: InventoryManagementDialogProps) {
  const tabsId = useId();
  const [mode, setMode] = useState<ManagementMode>("ADJUST");
  const [operation, setOperation] = useState<AdjustmentOperation>("REMOVE");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(1);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const initialDestination = WAREHOUSE_KINDS.find((value) => value !== warehouse) ?? warehouse;
  const [destinationWarehouse, setDestinationWarehouse] = useState<WarehouseKind>(initialDestination);
  const sourceLabel = warehouseLabel(warehouse);

  const operationDetail = operationDetails[operation];
  const signedAdjustment = operation === "ADD" ? adjustmentQuantity : -adjustmentQuantity;
  const nextQuantity = currentQuantity + signedAdjustment;
  const exceedsStock = nextQuantity < 0;
  const belowMinimum = (
    !exceedsStock &&
    minStock !== null &&
    minStock > 0 &&
    nextQuantity < minStock
  );
  const adjustmentConfirmMessage = `${allergenName} ${lotNo} ${sourceLabel} 창고 재고를 ${adjustmentQuantity}개 ${operationDetail.button}하시겠습니까? 변경 후 수량은 ${nextQuantity}개입니다.`;

  const destinationLabel = warehouseLabel(destinationWarehouse);
  const remainingQuantity = currentQuantity - transferQuantity;
  const transferQuantityInvalid = transferQuantity < 1 || remainingQuantity < 0;
  const transferConfirmMessage = `${allergenName} ${lotNo} 재고 ${transferQuantity}개를 ${sourceLabel}에서 ${destinationLabel}(으)로 이동하시겠습니까?`;

  return (
    <DialogFrame
      className="inventory-management-dialog"
      eyebrow="INVENTORY MANAGEMENT"
      showPlus={false}
      title="재고 관리"
      triggerClassName="table-action secondary"
      triggerDisabled={disabled}
      triggerLabel="재고 관리"
    >
      <div className="stock-adjustment-form inventory-management-shell">
        <section className="stock-adjustment-summary inventory-management-summary">
          <div><strong>{allergenName}</strong><span>{allergenCode}</span></div>
          <dl>
            <div><dt>제조번호</dt><dd>{lotNo}</dd></div>
            <div><dt>유통기한</dt><dd>{expirationDate}</dd></div>
            <div><dt>현재 창고</dt><dd>{sourceLabel}</dd></div>
            <div><dt>현재 수량</dt><dd>{currentQuantity}개</dd></div>
          </dl>
        </section>

        <div aria-label="재고 관리 방식" className="inventory-management-mode" role="tablist">
          <button
            aria-controls={`${tabsId}-adjust-panel`}
            aria-selected={mode === "ADJUST"}
            id={`${tabsId}-adjust-tab`}
            onClick={() => setMode("ADJUST")}
            role="tab"
            type="button"
          >
            재고 조정
          </button>
          <button
            aria-controls={`${tabsId}-transfer-panel`}
            aria-selected={mode === "TRANSFER"}
            disabled={currentQuantity < 1}
            id={`${tabsId}-transfer-tab`}
            onClick={() => setMode("TRANSFER")}
            role="tab"
            title={currentQuantity < 1 ? "이동 가능한 재고가 없습니다." : undefined}
            type="button"
          >
            창고 이동
          </button>
        </div>

        {currentQuantity < 1 ? (
          <p className="inventory-management-mode-note">
            현재 수량이 없어 창고 이동은 사용할 수 없습니다. 재고 조정에서 수량을 추가하세요.
          </p>
        ) : null}

        {mode === "ADJUST" ? (
          <form
            action={adjustLotStock}
            aria-labelledby={`${tabsId}-adjust-tab`}
            className="inventory-management-form"
            id={`${tabsId}-adjust-panel`}
            role="tabpanel"
          >
            <input name="lotId" type="hidden" value={lotId} />
            <input name="warehouse" type="hidden" value={warehouse} />

            <fieldset className="operation-options">
              <legend>처리 유형</legend>
              {(Object.keys(operationDetails) as AdjustmentOperation[]).map((value) => {
                const item = operationDetails[value];
                const Icon = item.icon;

                return (
                  <label key={value}>
                    <input
                      checked={operation === value}
                      name="operation"
                      onChange={() => setOperation(value)}
                      type="radio"
                      value={value}
                    />
                    <span><Icon aria-hidden="true" size={18} /><strong>{item.label}</strong></span>
                  </label>
                );
              })}
            </fieldset>

            <label className="stock-adjustment-field">
              변경 수량
              <div>
                <input
                  min={1}
                  name="quantity"
                  onChange={(event) => setAdjustmentQuantity(Math.max(0, Number(event.target.value)))}
                  required
                  step={1}
                  type="number"
                  value={adjustmentQuantity || ""}
                />
                <span>개</span>
              </div>
            </label>
            <label className="stock-adjustment-field">
              사유
              <input
                defaultValue={operationDetail.reason}
                key={operation}
                list={`${tabsId}-reason-${operation}`}
                maxLength={200}
                name="reason"
                placeholder="처리 사유를 입력하세요"
                required
              />
            </label>
            <datalist id={`${tabsId}-reason-ADD`}><option value="실사 결과 증가" /><option value="입고 누락 보정" /><option value="반품 재입고" /></datalist>
            <datalist id={`${tabsId}-reason-REMOVE`}><option value="실사 결과 감소" /><option value="파손" /><option value="분실" /></datalist>
            <datalist id={`${tabsId}-reason-DISPOSE`}><option value="유통기한 만료" /><option value="품질 이상" /><option value="보관 상태 불량" /></datalist>

            <section
              aria-live="polite"
              className={`stock-adjustment-preview${exceedsStock ? " danger" : belowMinimum ? " warning" : ""}`}
            >
              <span>변경 후 수량</span><strong>{currentQuantity}개 → {nextQuantity}개</strong>
              {exceedsStock ? <p>현재 수량보다 많이 차감할 수 없습니다.</p> : null}
              {belowMinimum ? <p>변경 후 안전 수량 {minStock}개 미만이 됩니다.</p> : null}
            </section>

            <div className="stock-adjustment-actions">
              <button className="secondary-button" data-dialog-close type="button">취소</button>
              <SubmitButton
                className={operation === "DISPOSE" ? "primary-button danger" : "primary-button"}
                confirmMessage={adjustmentConfirmMessage}
                disabled={exceedsStock || adjustmentQuantity < 1}
                pendingLabel="처리 중..."
              >
                {adjustmentQuantity || 0}개 {operationDetail.button}
              </SubmitButton>
            </div>
          </form>
        ) : (
          <form
            action={transferLotWarehouse}
            aria-labelledby={`${tabsId}-transfer-tab`}
            className="inventory-management-form"
            id={`${tabsId}-transfer-panel`}
            role="tabpanel"
          >
            <input name="lotId" type="hidden" value={lotId} />
            <input name="sourceWarehouse" type="hidden" value={warehouse} />

            <div
              aria-label={`${sourceLabel}에서 ${destinationLabel}(으)로 이동`}
              className="warehouse-transfer-route"
            >
              <span><small>출발 창고</small><strong>{sourceLabel}</strong></span>
              <ArrowRight aria-hidden="true" size={20} />
              <label>
                <small>도착 창고</small>
                <select
                  name="destinationWarehouse"
                  onChange={(event) => setDestinationWarehouse(event.target.value as WarehouseKind)}
                  required
                  value={destinationWarehouse}
                >
                  {WAREHOUSE_KINDS.filter((value) => value !== warehouse).map((value) => (
                    <option key={value} value={value}>{warehouseLabel(value)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="stock-adjustment-field">
              이동 수량
              <div>
                <input
                  max={currentQuantity}
                  min={1}
                  name="quantity"
                  onChange={(event) => setTransferQuantity(Math.max(0, Number(event.target.value)))}
                  required
                  step={1}
                  type="number"
                  value={transferQuantity || ""}
                />
                <span>개</span>
              </div>
            </label>

            <label className="stock-adjustment-field">
              이동 사유
              <input
                defaultValue="창고간 재고 이동"
                maxLength={200}
                name="reason"
                placeholder="이동 사유를 입력하세요"
                required
              />
            </label>

            <section
              aria-live="polite"
              className={`stock-adjustment-preview warehouse-transfer-preview${transferQuantityInvalid ? " danger" : ""}`}
            >
              <span>이동 후 출발 창고 수량</span>
              <strong>{currentQuantity}개 → {remainingQuantity}개</strong>
              {transferQuantityInvalid ? <p>현재 창고 수량보다 많이 이동할 수 없습니다.</p> : (
                <p><ArrowRightLeft aria-hidden="true" size={14} /> 총 재고 수량은 변하지 않습니다.</p>
              )}
            </section>

            <div className="stock-adjustment-actions">
              <button className="secondary-button" data-dialog-close type="button">취소</button>
              <SubmitButton
                className="primary-button"
                confirmMessage={transferConfirmMessage}
                disabled={transferQuantityInvalid}
                pendingLabel="이동 중..."
              >
                {transferQuantity || 0}개 이동
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </DialogFrame>
  );
}
