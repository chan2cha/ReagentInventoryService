import {
  dashboardSourceLabel,
  formatDate,
  getDashboardData
} from "./dashboard-data";
import {
  AppShell,
  Panel,
  StatGrid,
  StatusBadge,
  Table
} from "./reagent-ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, data] = await Promise.all([requireUser(), getDashboardData()]);
  const canReceive = can(user.role, "STOCK_WRITE");

  return (
    <AppShell
      active="/"
      title="업무 현황"
      description="재고, 주문, 출고 대기 상태를 한 화면에서 확인합니다."
      action={canReceive ? "새 입고 등록" : undefined}
      actionHref={canReceive ? "/receiving" : undefined}
    >
      <StatGrid stats={data.stats} />

      <div className="dashboard-grid">
        <Panel title="먼저 확인할 재고" note={`${dashboardSourceLabel(data.priorityLots)} · 유통기한 빠른 순`}>
          <Table>
            <thead>
              <tr>
                <th>시약명</th>
                <th>제조번호</th>
                <th>유통기한</th>
                <th>현재고</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.priorityLots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.allergenName}</td>
                  <td>{lot.lotNo}</td>
                  <td>{formatDate(lot.expirationDate)}</td>
                  <td>{lot.quantity}</td>
                  <td><StatusBadge status={lot.status} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel title="주문 상태" note={dashboardSourceLabel(data.orderSummary)}>
          <div className="split-list">
            {data.orderSummary.map((order) => (
              <div className="split-row" key={order.id}>
                <div>
                  <strong>{order.orderNo}</strong>
                  <span>{order.clientName}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="dashboard-grid lower">
        <Panel title="최근 입출고 이력" note={dashboardSourceLabel(data.recentMovements)}>
          <div className="activity-list">
            {data.recentMovements.map((movement) => (
              <div className="activity-item" key={movement.id}>
                <StatusBadge status={movement.type} />
                <div>
                  <strong>{movement.allergenName}</strong>
                  <span>{movement.lotNo} · {movement.quantity}개 · {movement.memo}</span>
                </div>
                <time>{formatDate(movement.date)}</time>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="교환 현황" note={`${dashboardSourceLabel([data.replacementSummary])} · 교환 관리 기준 적용`}>
          <div className="category-grid replacement-summary-grid">
            {[
              ["확인 대상", data.replacementSummary.candidateCount],
              ["교환 확정", data.replacementSummary.confirmedCount],
              ["교환 완료", data.replacementSummary.completedCount]
            ].map(([label, count]) => (
              <div className="category-tile" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
