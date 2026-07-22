import { AppShell, Panel, Table } from "../reagent-ui";
import { FlashMessage } from "../flash-message";
import { SubmitButton } from "../submit-button";
import { getFlashMessage } from "@/lib/flash-message";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { createWarehouse, toggleWarehouseActive } from "./actions";
import { getWarehouseRows } from "./warehouse-data";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const [user, rows, flash] = await Promise.all([requireUser(), getWarehouseRows(), getFlashMessage()]);
  const canManage = can(user.role, "USER_ADMIN");
  return <AppShell active="/warehouses" title="창고 관리" description="입고, 재고 조정과 창고 이동에 사용할 창고를 관리합니다.">
    <FlashMessage value={flash} />
    <div className={canManage ? "form-layout master-data-layout" : undefined}>
      <Panel title="창고 목록" note="비활성 창고는 새 입고·창고이동 선택지에서 제외됩니다. 재고가 남은 창고는 비활성화할 수 없습니다.">
        <Table><thead><tr><th>창고 코드</th><th>창고명</th><th>상태</th><th>보유 LOT</th><th>보유 수량</th><th>이동 이력</th>{canManage ? <th>관리</th> : null}</tr></thead><tbody>
          {rows.map((warehouse) => <tr key={warehouse.id}><td>{warehouse.code}</td><td>{warehouse.name}</td><td><span className={`status-badge ${warehouse.active ? "ok" : "muted"}`}>{warehouse.active ? "활성" : "비활성"}</span></td><td>{warehouse.stockLotCount}</td><td>{warehouse.stockQuantity}</td><td>{warehouse.movementCount}</td>{canManage ? <td><form action={toggleWarehouseActive}><input name="warehouseId" type="hidden" value={warehouse.id} /><SubmitButton className={warehouse.active ? "table-action danger" : "table-action"} confirmMessage={`${warehouse.name} 창고를 ${warehouse.active ? "비활성화" : "활성화"}하시겠습니까?`} disabled={warehouse.code === "FINISHED_GOODS" || (warehouse.active && warehouse.stockQuantity > 0)}>{warehouse.active ? "비활성화" : "활성화"}</SubmitButton></form></td> : null}</tr>)}
        </tbody></Table>
      </Panel>
      {canManage ? <Panel title="창고 추가"><form action={createWarehouse} className="entry-form compact-entry-form"><label>창고 코드<input maxLength={30} name="code" placeholder="예: COLD_STORAGE" required /></label><label>창고명<input maxLength={50} name="name" placeholder="예: 냉장 보관" required /></label><div className="form-actions"><SubmitButton className="primary-button" pendingLabel="추가 중...">창고 추가</SubmitButton></div></form></Panel> : null}
    </div>
  </AppShell>;
}
