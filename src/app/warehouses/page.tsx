import { AppShell, Panel, Table } from "../reagent-ui";
import { FlashMessage } from "../flash-message";
import { SubmitButton } from "../submit-button";
import { getFlashMessage } from "@/lib/flash-message";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { toggleWarehouseActive } from "./actions";
import { getWarehouseRows } from "./warehouse-data";
import { CreateWarehouseDialog } from "./create-warehouse-dialog";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const [user, rows, flash] = await Promise.all([requireUser(), getWarehouseRows(), getFlashMessage()]);
  const canManage = can(user.role, "USER_ADMIN");

  return (
    <AppShell active="/warehouses" title="창고 관리" description="입고, 재고 조정과 창고 이동에 사용하는 창고를 관리합니다.">
      <FlashMessage value={flash} />
      {canManage ? <div className="page-toolbar warehouse-toolbar"><CreateWarehouseDialog /></div> : null}

      <div className="warehouse-page-body">
        <Panel title="창고 목록" note="비활성 창고는 입고와 창고 이동 선택지에서 제외됩니다. 재고가 있는 창고는 비활성화할 수 없습니다.">
          <Table>
            <thead>
              <tr>
                <th>창고 코드</th><th>창고명</th><th>보유 재고</th><th>이동 이력</th><th>상태</th>
                {canManage ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td><code className="warehouse-code">{warehouse.code}</code></td>
                  <td><strong>{warehouse.name}</strong></td>
                  <td>
                    <span className="warehouse-stock">
                      <strong>{warehouse.stockLotCount}<small>LOT</small></strong>
                      <strong>{warehouse.stockQuantity}<small>개</small></strong>
                    </span>
                  </td>
                  <td><span className="warehouse-movement-count">{warehouse.movementCount}<small>건</small></span></td>
                  <td><span className={`status-badge ${warehouse.active ? "ok" : "muted"}`}>{warehouse.active ? "활성" : "비활성"}</span></td>
                  {canManage ? (
                    <td>
                      <form action={toggleWarehouseActive}>
                        <input name="warehouseId" type="hidden" value={warehouse.id} />
                        <SubmitButton
                          className={warehouse.active ? "table-action danger" : "table-action"}
                          confirmMessage={`${warehouse.name} 창고를 ${warehouse.active ? "비활성화" : "활성화"}하시겠습니까?`}
                          disabled={warehouse.code === "FINISHED_GOODS" || (warehouse.active && warehouse.stockQuantity > 0)}
                        >
                          {warehouse.active ? "비활성화" : "활성화"}
                        </SubmitButton>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 ? <tr><td className="table-empty" colSpan={canManage ? 6 : 5}>등록된 창고가 없습니다.</td></tr> : null}
            </tbody>
          </Table>
        </Panel>
      </div>
    </AppShell>
  );
}
