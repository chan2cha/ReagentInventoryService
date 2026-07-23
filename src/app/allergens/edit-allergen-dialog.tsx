"use client";

import { RegistrationDialog } from "../registration-dialog";
import { SubmitButton } from "../submit-button";
import { updateAllergen } from "./actions";

type EditAllergenDialogProps = {
  allergen: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
};

export function EditAllergenDialog({ allergen }: EditAllergenDialogProps) {
  return (
    <RegistrationDialog
      dialogClassName="allergen-edit-dialog"
      showPlus={false}
      title="시약 정보 수정"
      triggerClassName="table-action secondary"
      triggerLabel="수정"
    >
      <form action={updateAllergen} className="entry-form compact-entry-form">
        <input name="allergenId" type="hidden" value={allergen.id} />
        <label><span>시약 코드</span><input defaultValue={allergen.code} maxLength={30} name="code" placeholder="예: HDM-D1" required /></label>
        <label><span>시약명</span><input defaultValue={allergen.name} name="name" required /></label>
        <label><span>분류</span><input defaultValue={allergen.category === "-" ? "" : allergen.category} name="category" placeholder="예: 흡입성" /></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">취소</button>
          <SubmitButton className="primary-button" pendingLabel="저장 중...">저장</SubmitButton>
        </div>
      </form>
    </RegistrationDialog>
  );
}
