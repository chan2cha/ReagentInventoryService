import { requirePageRole } from "@/lib/auth";
import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createUser, resetUserPassword, toggleUserActive } from "./actions";
import { getUserRows, roleOptions } from "./user-data";
import { RegistrationDialog } from "../registration-dialog";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string; page?: string; q?: string }>;
}) {
  await requirePageRole(["ADMIN"]);

  const params=await searchParams; const data=await getUserRows(parsePage(params?.page), params?.q?.trim()); const users=data.rows;
  const error = params?.error;
  const success = params?.success;

  return (
    <AppShell
      active="/users"
      title="사용자 관리"
      description="내부 사용자 계정과 업무 권한을 관리합니다."
    >
      {error ? <div className="page-alert">{error}</div> : null}
      {success ? <div className="page-alert success">{success}</div> : null}

      <div className="page-toolbar"><RegistrationDialog title="사용자 등록" triggerLabel="사용자 등록"><form action={createUser} className="entry-form compact-entry-form"><label>아이디<input name="loginId" placeholder="예: order01" required /></label><label>이름<input name="name" placeholder="사용자 이름" required /></label><label>임시 비밀번호<input minLength={8} name="password" placeholder="8자 이상" required type="password" /></label><label>역할<select defaultValue="VIEWER" name="role" required>{roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label>이메일<input name="email" placeholder="선택 입력" type="email" /></label><div className="form-actions"><SubmitButton className="primary-button" pendingLabel="등록 중...">등록</SubmitButton></div></form></RegistrationDialog></div>
      <TableSearch pathname="/users" placeholder="아이디, 이름, 이메일 검색" value={params?.q} />
      <div>
        <Panel title="사용자 목록" note={`${users.length}명`}>
          <Table>
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>비밀번호</th>
                <th>등록일</th>
                <th>상태</th>
                <th>계정 처리</th>
                <th>비밀번호 재설정</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.loginId}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.roleLabel}</td>
                  <td>{user.mustChangePassword ? "변경 필요" : "완료"}</td>
                  <td>{user.createdAt.replaceAll("-", ".")}</td>
                  <td><StatusBadge status={user.active ? "정상" : "취소"} /></td>
                  <td>
                    <form action={toggleUserActive}>
                      <input name="userId" type="hidden" value={user.id} />
                      <SubmitButton className={user.active ? "table-action danger" : "table-action"} confirmMessage={`${user.name} 사용자를 ${user.active ? "비활성화" : "활성화"}하시겠습니까?`} pendingLabel="처리 중...">
                        {user.active ? "비활성화" : "활성화"}
                      </SubmitButton>
                    </form>
                  </td>
                  <td>
                    <form action={resetUserPassword} className="inline-password-form">
                      <input name="userId" type="hidden" value={user.id} />
                      <input minLength={8} name="password" placeholder="임시 비밀번호" required type="password" />
                      <SubmitButton className="table-action" confirmMessage={`${user.name} 사용자의 비밀번호를 입력한 임시 비밀번호로 재설정하시겠습니까? 다음 로그인 시 비밀번호 변경이 필요합니다.`} pendingLabel="재설정 중...">
                        재설정
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Pagination page={data.page} pathname="/users" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />

      </div>
    </AppShell>
  );
}
