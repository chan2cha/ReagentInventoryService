"use client";

import { RegistrationDialog } from "../registration-dialog";
import { SubmitButton } from "../submit-button";
import { createAllergen } from "./actions";


export function CreateAllergenDialog() {
  return (
    <RegistrationDialog
      dialogClassName="allergen-create-dialog"
      showPlus={true}
      title="시약 등록"
      triggerClassName="secondary-button dialog-trigger"
      triggerLabel="시약 등록"
    >
     <form action={createAllergen} className="entry-form compact-entry-form">
            <label>시약 코드<input maxLength={30} name="code" placeholder="예: HDM-D1" required /></label>
            <label>시약명<input name="name" placeholder="시약명" required /></label>
            <label>분류<input name="category" placeholder="예: 흡입성" /></label>
            <div className="form-actions"><SubmitButton className="primary-button" pendingLabel="등록 중...">시약 등록</SubmitButton></div>
          </form>
    </RegistrationDialog>
  );
}
