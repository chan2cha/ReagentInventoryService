"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="service-error-page">
      <section className="service-error-content">
        <AlertTriangle aria-hidden="true" size={30} strokeWidth={1.8} />
        <p className="eyebrow">SERVICE ERROR</p>
        <h1>요청을 처리하지 못했습니다</h1>
        <p>일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요. 문제가 계속되면 관리자에게 문의하세요.</p>
        <button className="primary-button" onClick={reset} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          다시 시도
        </button>
      </section>
    </main>
  );
}
