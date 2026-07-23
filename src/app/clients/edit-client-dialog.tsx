"use client";

import { RegistrationDialog } from "../registration-dialog";
import { SubmitButton } from "../submit-button";
import { updateClient } from "./actions";

type EditClientDialogProps = {
  client: {
    id: string;
    name: string;
    region: string;
    manager: string;
    deliveryDepartment: string;
    memo: string;
  };
};

export function EditClientDialog({ client }: EditClientDialogProps) {
  return (
    <RegistrationDialog
      dialogClassName="client-edit-dialog"
      showPlus={false}
      title="거래처 정보 수정"
      triggerClassName="table-action secondary"
      triggerLabel="수정"
    >
      <form action={updateClient} className="entry-form compact-entry-form">
        <input name="clientId" type="hidden" value={client.id} />
        <label><span>거래처명</span><input defaultValue={client.name} name="name" required /></label>
        <label><span>지역</span><input defaultValue={client.region === "-" ? "" : client.region} name="region" placeholder="예: 서울 종로구" /></label>
        <label><span>담당자</span><input defaultValue={client.manager === "-" ? "" : client.manager} name="managerName" placeholder="선택 입력" /></label>
        <label><span>납품과</span><input defaultValue={client.deliveryDepartment === "-" ? "" : client.deliveryDepartment} name="deliveryDepartment" placeholder="예: 진단검사의학과" /></label>
        <label><span>메모</span><textarea defaultValue={client.memo} name="memo" placeholder="거래처 관련 참고사항" /></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">취소</button>
          <SubmitButton className="primary-button" pendingLabel="저장 중...">저장</SubmitButton>
        </div>
      </form>
    </RegistrationDialog>
  );
}
