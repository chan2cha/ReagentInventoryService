import Image from "next/image";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/app/submit-button";
import { FlashMessage } from "@/app/flash-message";
import { getCurrentUser } from "@/lib/auth";
import { getFlashMessage } from "@/lib/flash-message";
import loginBackground from "@/lib/login_container_bg.jpg";
import companyLogo from "@/lib/logo.png.png";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [user, flash] = await Promise.all([
    getCurrentUser(),
    getFlashMessage()
  ]);

  if (user) {
    redirect("/");
  }

  return (
    <main className="login-page">
      <Image
        alt=""
        aria-hidden
        className="login-background"
        fill
        priority
        sizes="100vw"
        src={loginBackground}
      />
      <header className="login-brand-bar">
        <Image
          alt="신영로파마"
          height={56}
          priority
          src={companyLogo}
          width={206}
        />
      </header>

      <section className="login-panel">
        <div>
          <p className="eyebrow">SHINYOUNG Lofarma</p>
          <strong className="login-system-title">시약 재고 관리 시스템</strong>
        </div>

        <FlashMessage form value={flash} />

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
