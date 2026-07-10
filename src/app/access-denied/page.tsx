import Link from "next/link";
import { ShieldX } from "lucide-react";
import { AppShell } from "../reagent-ui";

export default function AccessDeniedPage() {
  return (
    <AppShell active="/access-denied" title="접근 권한 없음" description="현재 계정에는 이 작업 화면을 사용할 권한이 없습니다.">
      <section className="access-denied-content">
        <ShieldX aria-hidden="true" size={34} strokeWidth={1.8} />
        <h2>업무 정보 조회는 다른 메뉴에서 계속할 수 있습니다</h2>
        <p>계정 역할 변경이 필요하면 시스템 관리자에게 요청하세요.</p>
        <Link className="primary-button" href="/">업무 현황으로 이동</Link>
      </section>
    </AppShell>
  );
}
