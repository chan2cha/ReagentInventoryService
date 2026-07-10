"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route failed", error);
  }, [error]);

  return (
    <main className="service-error-page">
      <section className="service-error-content">
        <AlertTriangle aria-hidden="true" size={30} strokeWidth={1.8} />
        <p className="eyebrow">SERVICE CONNECTION</p>
        <h1>최신 정보를 불러오지 못했습니다</h1>
        <p>데이터베이스 연결 상태를 확인한 뒤 다시 시도하세요. 화면에는 임시 데이터가 표시되지 않습니다.</p>
        <button className="primary-button" onClick={reset} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          다시 시도
        </button>
      </section>
    </main>
  );
}
