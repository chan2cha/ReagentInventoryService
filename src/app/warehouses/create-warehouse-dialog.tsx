"use client";

import { RegistrationDialog } from "../registration-dialog";
import { SubmitButton } from "../submit-button";
import { createWarehouse } from "./actions";

export function CreateWarehouseDialog() {
  return (
    <RegistrationDialog
      dialogClassName="warehouse-create-dialog"
      title="창고 추가"
      triggerLabel="창고 추가"
    >
      <form action={createWarehouse} className="entry-form compact-entry-form">
        <label><span>창고 코드</span><input maxLength={30} name="code" placeholder="예: COLD_STORAGE" required /></label>
        <label><span>창고명</span><input maxLength={50} name="name" placeholder="예: 냉장 보관" required /></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">취소</button>
          <SubmitButton className="primary-button" pendingLabel="추가 중...">추가</SubmitButton>
        </div>
      </form>
    </RegistrationDialog>
  );
}
