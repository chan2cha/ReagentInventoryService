"use client";

import { useMemo, useState } from "react";
import { RegistrationDialog } from "../registration-dialog";
import { SearchableSelect, type SearchableSelectOption } from "../searchable-select";
import { SubmitButton } from "../submit-button";
import { registerDefectReplacement } from "./actions";

type ManualReplacementCandidate = {
  id: string;
  clientName: string;
  orderNo: string;
  allergenCode: string;
  allergenName: string;
  lotNo: string;
  shippedQuantity: number;
};

export function DefectReplacementDialog({ candidates }: { candidates: readonly ManualReplacementCandidate[] }) {
  const [shipmentItemId, setShipmentItemId] = useState("");
  const options = useMemo<SearchableSelectOption[]>(() => candidates.map((item) => ({
    id: item.id,
    label: `${item.allergenCode} · ${item.allergenName}`,
    description: `${item.clientName} · ${item.orderNo} · ${item.lotNo} · 출고 ${item.shippedQuantity}개`,
    keywords: [item.clientName, item.orderNo, item.allergenCode, item.allergenName, item.lotNo]
  })), [candidates]);

  return (
    <RegistrationDialog
      dialogClassName="replacement-defect-dialog"
      title="제품 하자 교환 등록"
      triggerDisabled={candidates.length === 0}
      triggerLabel="제품 하자 교환 등록"
    >
      <form action={registerDefectReplacement} className="entry-form compact-entry-form">
        <p className="replacement-defect-dialog-note">유통기한과 관계없이 기존 출고품의 하자를 기준으로 교환을 등록합니다.</p>
        <SearchableSelect
          className="wide"
          disabled={candidates.length === 0}
          label="기존 출고 품목"
          name="shipmentItemId"
          onChange={setShipmentItemId}
          options={options}
          placeholder="거래처, 주문번호, 시약명 또는 제조번호 검색"
          required
          value={shipmentItemId}
        />
        <label><span>교환 수량</span><input min={1} name="quantity" placeholder="수량" required type="number" /></label>
        <label className="wide"><span>제품 하자 사유</span><textarea maxLength={500} name="reason" placeholder="예: 포장 파손, 이물 확인, 외관 불량" required /></label>
        <div className="form-actions wide">
          <button className="secondary-button" data-dialog-close type="button">취소</button>
          <SubmitButton className="primary-button" confirmMessage="제품 하자 교환을 등록하시겠습니까? 교환품 출고 전까지는 재고가 차감되지 않습니다." pendingLabel="등록 중...">등록</SubmitButton>
        </div>
      </form>
    </RegistrationDialog>
  );
}
