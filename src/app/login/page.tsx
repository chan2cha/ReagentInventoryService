import Image from "next/image";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/app/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const [user, params] = await Promise.all([
    getCurrentUser(),
    searchParams
  ]);

  if (user) {
    redirect("/");
  }

  const error = params?.error;

  return (
    <main className="login-page">
      <header className="login-brand-bar">
        <Image
          alt="신영라파마"
          height={56}
          priority
          src="/logo.png"
          width={206}
        />
      </header>

      <section className="login-panel">
        <div>
          <p className="eyebrow">SHINYOUNG Lofarma</p>
          <strong className="login-system-title">시약 재고 관리 시스템</strong>
        </div>

        {error ? <div className="form-alert">{error}</div> : null}

        <form action={login} className="login-form">
          <label>
            아이디
            <input autoComplete="username" name="loginId" placeholder="아이디" required />
          </label>
          <label>
            비밀번호
            <input autoComplete="current-password" name="password" placeholder="비밀번호" required type="password" />
          </label>
          <SubmitButton className="primary-button" pendingLabel="로그인 중...">
            로그인
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
