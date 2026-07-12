import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  History,
  KeyRound,
  Layers,
  PackageCheck,
  PackagePlus,
  ScrollText,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import { logout } from "@/app/logout/actions";
import { requireUser } from "@/lib/auth";
import { can, type Capability } from "@/lib/access";
import { formatKoreaDateTime } from "@/lib/date";
import type { StockMovementLabel } from "@/domain/stock-movement-presentation";
import { formatSidebarBadge, getSidebarData } from "./sidebar-data";
import {
  dashboard,
  findAllergen,
  findClient,
  formatDate,
  lotStatus,
  orders,
  today,
  type LotStatus,
  type OrderStatus
} from "./reagent-data";

type ShellProps = {
  active: AppRoute;
  title: string;
  description: string;
  action?: string;
  actionHref?: ActionRoute;
  children: React.ReactNode;
};

type AppRoute = "/" | "/lots" | "/receiving" | "/orders" | "/orders/templates" | "/shipments" | "/clients" | "/allergens" | "/movements" | "/exports" | "/audit" | "/users" | "/account/password" | "/access-denied";
type ActionRoute = AppRoute | "/orders/new";

const navItems: Array<{ href: AppRoute; label: string; icon: LucideIcon; capability?: Capability }> = [
  { href: "/", label: "업무 현황", icon: Gauge },
  { href: "/lots", label: "재고 현황", icon: Boxes },
  { href: "/receiving", label: "입고 등록", icon: PackagePlus, capability: "STOCK_WRITE" },
  { href: "/orders", label: "주문 관리", icon: ClipboardList },
  { href: "/orders/templates", label: "주문 세트", icon: Layers, capability: "ORDER_TEMPLATE_WRITE" },
  { href: "/shipments", label: "출고 처리", icon: PackageCheck },
  { href: "/clients", label: "거래처", icon: Building2 },
  { href: "/allergens", label: "시약 관리", icon: FlaskConical },
  { href: "/movements", label: "입출고 이력", icon: History },
  { href: "/exports", label: "자료 내보내기", icon: FileSpreadsheet, capability: "DATA_EXPORT" },
  { href: "/audit", label: "감사 로그", icon: ScrollText, capability: "AUDIT_READ" },
  { href: "/account/password", label: "비밀번호 변경", icon: KeyRound },
  { href: "/users", label: "사용자 관리", icon: ShieldCheck, capability: "USER_ADMIN" }
];

const roleLabels = {
  ADMIN: "관리자",
  ORDER_MANAGER: "주문관리",
  SHIPMENT_MANAGER: "출고담당",
  VIEWER: "조회"
};

export async function AppShell({ active, title, description, action, actionHref, children }: ShellProps) {
  const user = await requireUser();

  if (user.mustChangePassword && active !== "/account/password") {
    redirect("/account/password" as never);
  }

  const sidebarData = user.mustChangePassword
    ? { pendingShipments: null }
    : await getSidebarData();
  const pendingShipmentBadge = formatSidebarBadge(sidebarData.pendingShipments);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand-block" href="/">
          <Image alt="신영라파마" height={48} priority src="/logo.png" width={177} />
          <span>
            <strong>시약 재고 관리 시스템</strong>
            <small>SHINYOUNG Lofarma</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label="메뉴">
          {navItems.filter((item) => !item.capability || can(user.role, item.capability)).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={item.href === active ? "active" : ""}
                href={item.href as never}
                key={item.href}
              >
                <span className="nav-mark"><Icon aria-hidden="true" size={17} strokeWidth={2} /></span>
                <span>{item.label}</span>
                {item.href === "/shipments" && pendingShipmentBadge ? (
                  <em
                    aria-label={`출고 대기 ${sidebarData.pendingShipments}건`}
                    title={`출고 대기 ${sidebarData.pendingShipments}건`}
                  >
                    {pendingShipmentBadge}
                  </em>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <small>{roleLabels[user.role]}</small>
            <span className="database-status" title="현재 화면 정보를 데이터베이스에서 조회한 시각">
              <i /> 최신 정보 확인 · {formatKoreaDateTime()}
            </span>
          <form action={logout}>
            <button className="logout-button" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">SHINYOUNG LOFARMA · LAB OPERATIONS</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {action && actionHref ? (
            <Link className="primary-button" href={actionHref as never}>{action}</Link>
          ) : null}
          {action && !actionHref ? <button className="primary-button" type="button">{action}</button> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

export function StatGrid({
  stats = dashboard
}: {
  stats?: {
    todayOrders: number;
    pendingShipments: number;
    todayShipments: number;
    expiringLots: number;
    lowLots: number;
  };
}) {
  const items = [
    ["오늘 주문", stats.todayOrders],
    ["출고 대기", stats.pendingShipments],
    ["오늘 출고", stats.todayShipments],
    ["곧 만료", stats.expiringLots],
    ["재고 부족", stats.lowLots]
  ];

  return (
    <section className="stat-grid" aria-label="업무 요약">
      {items.map(([label, value]) => (
        <article className="stat-tile" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export function StatusBadge({ status }: { status: LotStatus | OrderStatus | StockMovementLabel }) {
  const className = {
    정상: "ok",
    재고부족: "warn",
    품절: "danger",
    "유통기한 임박": "warn",
    "유통기한 만료": "danger",
    접수: "info",
    준비중: "warn",
    출고완료: "ok",
    취소: "muted",
    입고: "info",
    출고: "ok",
    조정: "warn",
    폐기: "danger",
    "출고취소/복구": "muted"
  }[status];

  const label = status === "품절" ? "재고 없음" : status;

  return <span className={`status-badge ${className}`}>{label}</span>;
}

export function Panel({
  title,
  note,
  children
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {note ? <span>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data-table">{children}</table>
    </div>
  );
}

export function AllergenName({ id }: { id: number }) {
  const allergen = findAllergen(id);
  return (
    <span className="stacked">
      <strong>{allergen?.name ?? "-"}</strong>
      <small>{allergen?.code ?? "-"}</small>
    </span>
  );
}

export function ClientName({ id }: { id: number }) {
  const client = findClient(id);
  return (
    <span className="stacked">
      <strong>{client?.name ?? "-"}</strong>
      <small>{client?.manager ?? "-"}</small>
    </span>
  );
}

export function OrderStatusSummary() {
  return (
    <div className="split-list">
      {orders.slice(0, 4).map((order) => (
        <div className="split-row" key={order.id}>
          <div>
            <strong>{order.orderNo}</strong>
            <span>{findClient(order.clientId)?.name}</span>
          </div>
          <StatusBadge status={order.status} />
        </div>
      ))}
    </div>
  );
}

export { lotStatus };
