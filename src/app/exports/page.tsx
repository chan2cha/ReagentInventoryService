import { requirePageRole } from "@/lib/auth";
import { AppShell } from "../reagent-ui";
import { ExportCenter } from "./export-center";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  await requirePageRole(["ADMIN", "ORDER_MANAGER", "SHIPMENT_MANAGER"]);

  return (
    <AppShell
      active="/exports"
      description="재고 현황과 입출고 이력을 조건에 맞춰 엑셀 파일로 저장합니다."
      title="자료 내보내기"
    >
      <ExportCenter />
    </AppShell>
  );
}
