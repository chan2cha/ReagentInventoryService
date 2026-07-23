"use client";

import { RegistrationDialog } from "../registration-dialog";
import { SubmitButton } from "../submit-button";
import { updateReplacementPolicy } from "./actions";

type ReplacementPolicyDialogProps = {
  detectionDays: number;
  minimumDeliveryShelfDays: number;
};

export function ReplacementPolicyDialog({
  detectionDays,
  minimumDeliveryShelfDays
}: ReplacementPolicyDialogProps) {
  return (
    <RegistrationDialog
      dialogClassName="replacement-policy-dialog"
      showPlus={false}
      title="교환 기준 설정"
      triggerClassName="secondary-button dialog-trigger"
      triggerLabel="교환 기준 설정"
    >
      <form action={updateReplacementPolicy} className="entry-form compact-entry-form">
        <p className="replacement-policy-dialog-note">유통기한 임박 교환의 확인 시점과 교환품의 최소 잔여 유통기한을 설정합니다.</p>
        <label><span>교환 통지·확인 기준일</span><span className="policy-number-input"><input aria-label="교환 통지·확인 기준일" defaultValue={detectionDays} min={1} max={3650} name="detectionDays" required type="number" /><em>일 전</em></span></label>
        <label><span>교환품 최소 잔여 유통기한</span><span className="policy-number-input"><input aria-label="교환품 최소 잔여 유통기한" defaultValue={minimumDeliveryShelfDays} min={1} max={3650} name="minimumDeliveryShelfDays" required type="number" /><em>일</em></span></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">취소</button>
          <SubmitButton className="primary-button" pendingLabel="저장 중...">저장</SubmitButton>
        </div>
      </form>
    </RegistrationDialog>
  );
}
