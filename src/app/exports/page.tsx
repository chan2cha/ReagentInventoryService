import { requirePageRole } from "@/lib/auth";
import { AppShell } from "../reagent-ui";
import { ExportCenter } from "./export-center";
import { getWarehouseOptions } from "@/lib/warehouse-data";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const [, warehouses] = await Promise.all([
    requirePageRole(["ADMIN", "ORDER_MANAGER", "SHIPMENT_MANAGER"]),
    getWarehouseOptions()
  ]);

  return (
    <AppShell
      active="/exports"
      description="재고 현황과 입출고 이력을 조건에 맞춰 엑셀 파일로 저장합니다."
      title="자료 내보내기"
    >
      <ExportCenter warehouses={warehouses} />
    </AppShell>
  );
}
