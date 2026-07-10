import { AppShell, Panel } from "@/app/reagent-ui";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function PasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <AppShell
      active="/account/password"
      title="비밀번호 변경"
      description="현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다."
    >
      <div className="form-layout account-layout">
        <Panel title="비밀번호 변경">
          {error ? <div className="form-alert">{error}</div> : null}
          <form action={changePassword} className="entry-form compact-entry-form">
            <label>
              현재 비밀번호
              <input autoComplete="current-password" name="currentPassword" required type="password" />
            </label>
            <label>
              새 비밀번호
              <input autoComplete="new-password" minLength={8} name="newPassword" required type="password" />
            </label>
            <label>
              새 비밀번호 확인
              <input autoComplete="new-password" minLength={8} name="confirmPassword" required type="password" />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                비밀번호 저장
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="변경 기준">
          <div className="rule-list">
            <p>신규 등록 사용자는 첫 로그인 후 비밀번호를 변경해야 합니다.</p>
            <p>새 비밀번호는 8자 이상이어야 합니다.</p>
            <p>변경 후 기존 세션은 유지되며 업무 화면으로 이동합니다.</p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
