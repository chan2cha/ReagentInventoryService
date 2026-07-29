import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import {
  DEFAULT_LOT_SORT,
  formatDate,
  getLotRows,
  isLotSortKind,
  LOT_SORT_KINDS,
  lotSortLabel,
  lotSourceLabel
} from "./lot-data";
import { InventoryManagementDialog } from "./inventory-management-dialog";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination";
import { Pagination } from "../pagination";
import { ExportDownloadButton } from "../exports/export-download-button";
import { isLotStatusFilter, lotStatusLabel } from "@/domain/lot-status";
import { warehouseLabel } from "@/domain/warehouse";
import { getWarehouseOptions } from "@/lib/warehouse-data";
import { LotTableFilters } from "./lot-table-filters";
import { LotSortControl } from "./lot-sort-control";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";

export const dynamic = "force-dynamic";

export default async function LotsPage({
  searchParams
}: {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    status?: string;
    warehouse?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const [user, flash, warehouses, warehouseLabels] = await Promise.all([
    requireUser(), getFlashMessage(), getWarehouseOptions(), getWarehouseOptions(false)
  ]);
  const statusParam = params?.status?.trim() ?? "";
  const lotStatus = isLotStatusFilter(statusParam) ? statusParam : undefined;
  const warehouseParam = params?.warehouse?.trim() ?? "";
  const warehouse = warehouses.some((item) => item.code === warehouseParam) ? warehouseParam : undefined;
  const sortParam = params?.sort?.trim() ?? "";
  const lotSort = isLotSortKind(sortParam) ? sortParam : DEFAULT_LOT_SORT;
  const data = await getLotRows(
    parsePage(params?.page),
    params?.q?.trim(),
    lotStatus,
    warehouse,
    lotSort
  );
  const lotRows = data.rows;
  const canWrite = can(user.role, "STOCK_WRITE");
  const canExport = can(user.role, "DATA_EXPORT");

  return (
    <AppShell
      active="/lots"
      title="재고 현황"
      description="시약별 제조번호, 창고, 유통기한과 현재 수량을 확인하고 창고간 재고를 이동합니다."
      action={canWrite ? "입고 등록" : undefined}
      actionHref={canWrite ? "/receiving" : undefined}
    >
      <FlashMessage value={flash} />
      <div className="table-filter-toolbar extended-filter-toolbar">
        <LotTableFilters
          q={params?.q}
          status={lotStatus}
          warehouse={warehouse}
          sort={lotSort}
          warehouses={warehouses}
        />
        {canExport ? (
          <ExportDownloadButton
            fallbackFileName="재고-현황.xlsx"
            label="현재 조건 엑셀"
            query={{ report: "inventory", q: params?.q, status: lotStatus, warehouse }}
          />
        ) : null}
      </div>
      <Panel
        headerAction={(
          <LotSortControl
            defaultSort={DEFAULT_LOT_SORT}
            options={LOT_SORT_KINDS.map((value) => ({
              label: lotSortLabel(value),
              value
            }))}
            q={params?.q?.trim()}
            sort={lotSort}
            status={lotStatus}
            warehouse={warehouse}
          />
        )}
        title="창고별 입고분 목록"
        note={`${lotSourceLabel(lotRows)} · ${lotStatus === "ALL" ? "전체 상태" : lotStatus ? lotStatusLabel(lotStatus) : "재고 보유"}${warehouse ? ` · ${warehouseLabel(warehouse, warehouseLabels)}` : ""}`}
      >
        <div className="lot-inventory-table">
          <Table>
            <thead>
              <tr>
                <th>시약명</th>
                <th>제조번호</th>
                <th>창고</th>
                <th>입고일</th>
                <th>유통기한</th>
                <th>현재 수량</th>
                <th>상태</th>
                {canWrite ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {lotRows.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <span className="stacked">
                      <strong>{lot.allergenName}</strong>
                      <small>{lot.allergenCode}</small>
                    </span>
                  </td>
                  <td>{lot.lotNo}</td>
                  <td><span className="warehouse-label">{warehouseLabel(lot.warehouse, warehouseLabels)}</span></td>
                  <td>{formatDate(lot.receivedDate)}</td>
                  <td>{formatDate(lot.expirationDate)}</td>
                  <td>{lot.currentQuantity}</td>
                  <td><StatusBadge status={lot.status} /></td>
                  {canWrite ? (
                    <td>
                      <div className="table-actions lot-table-actions">
                        <InventoryManagementDialog
                          allergenCode={lot.allergenCode}
                          allergenName={lot.allergenName}
                          currentQuantity={lot.currentQuantity}
                          disabled={lot.source !== "database"}
                          expirationDate={formatDate(lot.expirationDate)}
                          lotId={lot.lotId}
                          lotNo={lot.lotNo}
                          warehouse={lot.warehouse}
                          warehouses={warehouses}
                          labelWarehouses={warehouseLabels}
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Pagination
          page={data.page}
          pathname="/lots"
          preserve={{
            q: params?.q,
            status: lotStatus,
            warehouse,
            sort: lotSort === DEFAULT_LOT_SORT ? undefined : lotSort
          }}
          total={data.total}
          totalPages={data.totalPages}
        />
      </Panel>
    </AppShell>
  );
}
