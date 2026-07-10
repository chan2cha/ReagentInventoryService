import { useState, useMemo, type ReactNode } from "react";
import {
  LayoutDashboard, Package, PackagePlus, ClipboardList,
  Truck, Building2, FlaskConical, History, Settings,
  Search, AlertTriangle, CheckCircle, Plus, X, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = "dashboard" | "inventory" | "receiving" | "orders" | "dispatch" | "clients" | "antigens" | "history" | "settings";
type StockStatus = "정상" | "재고부족" | "품절" | "유통기한 임박" | "유통기한 만료";
type OrderStatus = "접수" | "준비중" | "출고완료" | "취소";
type HistoryType = "입고" | "출고" | "조정" | "폐기";

interface Antigen { id: number; code: string; name: string; category: string; minStock: number; }
interface InventoryItem { id: number; antigenId: number; lotNo: string; quantity: number; receivedDate: string; expiryDate: string; }
interface Client { id: number; name: string; contactPerson: string; phone: string; address: string; }
interface OrderItem { antigenId: number; quantity: number; }
interface Order { id: number; orderNo: string; clientId: number; orderDate: string; items: OrderItem[]; status: OrderStatus; notes: string; }
interface HistoryRecord { id: number; date: string; type: HistoryType; antigenId: number; lotNo: string; quantity: number; memo: string; orderId?: number; }

// ─── Static reference data ────────────────────────────────────────────────────

const TODAY = "2026-07-09";

const ANTIGENS: Antigen[] = [
  { id: 1,  code: "HDM-D1", name: "집먼지 진드기 (D.pteronyssinus)", category: "흡입성", minStock: 10 },
  { id: 2,  code: "HDM-D2", name: "집먼지 진드기 (D.farinae)",       category: "흡입성", minStock: 10 },
  { id: 3,  code: "DOG-01", name: "개 비듬",                         category: "흡입성", minStock: 8  },
  { id: 4,  code: "CAT-01", name: "고양이 비듬",                     category: "흡입성", minStock: 8  },
  { id: 5,  code: "BIR-01", name: "자작나무 꽃가루",                 category: "흡입성", minStock: 6  },
  { id: 6,  code: "GRS-01", name: "잔디 꽃가루 혼합",               category: "흡입성", minStock: 6  },
  { id: 7,  code: "MLK-01", name: "우유",                           category: "식품성", minStock: 12 },
  { id: 8,  code: "EGG-01", name: "달걀 흰자",                       category: "식품성", minStock: 12 },
  { id: 9,  code: "PNT-01", name: "땅콩",                           category: "식품성", minStock: 10 },
  { id: 10, code: "SHR-01", name: "새우",                           category: "식품성", minStock: 8  },
  { id: 11, code: "WHT-01", name: "밀가루",                         category: "식품성", minStock: 10 },
  { id: 12, code: "PCH-01", name: "복숭아",                         category: "식품성", minStock: 6  },
];

const CLIENTS: Client[] = [
  { id: 1, name: "서울대학교병원",     contactPerson: "김정호", phone: "02-2072-2114", address: "서울 종로구 대학로 101" },
  { id: 2, name: "삼성서울병원",       contactPerson: "이수진", phone: "02-3410-2114", address: "서울 강남구 일원로 81" },
  { id: 3, name: "서울아산병원",       contactPerson: "박미영", phone: "02-3010-3114", address: "서울 송파구 올림픽로43길 88" },
  { id: 4, name: "세브란스병원",       contactPerson: "최동현", phone: "02-2228-1004", address: "서울 서대문구 연세로 50-1" },
  { id: 5, name: "고려대학교의료원",   contactPerson: "정희원", phone: "02-920-5114",  address: "서울 성북구 고려대로 73" },
  { id: 6, name: "분당서울대학교병원", contactPerson: "한상민", phone: "031-787-7114", address: "경기 성남시 분당구 구미로173번길 82" },
];

const INIT_INVENTORY: InventoryItem[] = [
  { id: 1,  antigenId: 1,  lotNo: "LOT-2501-HDM1-A", quantity: 18, receivedDate: "2025-01-15", expiryDate: "2027-03-15" },
  { id: 2,  antigenId: 1,  lotNo: "LOT-2501-HDM1-B", quantity: 4,  receivedDate: "2025-01-20", expiryDate: "2026-07-25" },
  { id: 3,  antigenId: 1,  lotNo: "LOT-2508-HDM1-C", quantity: 30, receivedDate: "2026-07-08", expiryDate: "2027-12-01" },
  { id: 4,  antigenId: 2,  lotNo: "LOT-2502-HDM2-A", quantity: 0,  receivedDate: "2025-02-10", expiryDate: "2026-12-10" },
  { id: 5,  antigenId: 3,  lotNo: "LOT-2503-DOG-A",  quantity: 22, receivedDate: "2025-03-05", expiryDate: "2027-06-20" },
  { id: 6,  antigenId: 4,  lotNo: "LOT-2503-CAT-A",  quantity: 3,  receivedDate: "2025-03-10", expiryDate: "2026-07-18" },
  { id: 7,  antigenId: 5,  lotNo: "LOT-2504-BIR-A",  quantity: 15, receivedDate: "2025-04-01", expiryDate: "2027-04-30" },
  { id: 8,  antigenId: 6,  lotNo: "LOT-2504-GRS-A",  quantity: 0,  receivedDate: "2025-04-15", expiryDate: "2026-06-15" },
  { id: 9,  antigenId: 7,  lotNo: "LOT-2505-MLK-A",  quantity: 28, receivedDate: "2025-05-20", expiryDate: "2027-09-01" },
  { id: 10, antigenId: 8,  lotNo: "LOT-2505-EGG-A",  quantity: 16, receivedDate: "2025-05-22", expiryDate: "2027-01-15" },
  { id: 11, antigenId: 8,  lotNo: "LOT-2508-EGG-B",  quantity: 6,  receivedDate: "2026-07-03", expiryDate: "2026-09-15" },
  { id: 12, antigenId: 9,  lotNo: "LOT-2506-PNT-A",  quantity: 2,  receivedDate: "2025-06-10", expiryDate: "2026-08-05" },
  { id: 13, antigenId: 10, lotNo: "LOT-2506-SHR-A",  quantity: 14, receivedDate: "2025-06-29", expiryDate: "2027-05-22" },
  { id: 14, antigenId: 11, lotNo: "LOT-2507-WHT-A",  quantity: 5,  receivedDate: "2025-07-15", expiryDate: "2026-07-30" },
  { id: 15, antigenId: 12, lotNo: "LOT-2507-PCH-A",  quantity: 0,  receivedDate: "2025-07-20", expiryDate: "2026-05-10" },
];

const INIT_ORDERS: Order[] = [
  { id: 1, orderNo: "ORD-20260709-001", clientId: 1, orderDate: "2026-07-09", items: [{ antigenId: 1, quantity: 5 }, { antigenId: 8, quantity: 3 }], status: "접수",    notes: "" },
  { id: 2, orderNo: "ORD-20260709-002", clientId: 4, orderDate: "2026-07-09", items: [{ antigenId: 8, quantity: 5 }, { antigenId: 2, quantity: 4 }], status: "접수",    notes: "긴급" },
  { id: 3, orderNo: "ORD-20260708-001", clientId: 2, orderDate: "2026-07-08", items: [{ antigenId: 4, quantity: 4 }, { antigenId: 9, quantity: 6 }], status: "준비중",  notes: "" },
  { id: 4, orderNo: "ORD-20260708-002", clientId: 5, orderDate: "2026-07-08", items: [{ antigenId: 9, quantity: 8 }, { antigenId: 10, quantity: 6 }], status: "준비중", notes: "" },
  { id: 5, orderNo: "ORD-20260707-001", clientId: 3, orderDate: "2026-07-07", items: [{ antigenId: 7, quantity: 10 }, { antigenId: 11, quantity: 5 }], status: "출고완료", notes: "" },
  { id: 6, orderNo: "ORD-20260706-001", clientId: 4, orderDate: "2026-07-06", items: [{ antigenId: 3, quantity: 8 }],  status: "출고완료", notes: "" },
  { id: 7, orderNo: "ORD-20260704-001", clientId: 6, orderDate: "2026-07-04", items: [{ antigenId: 10, quantity: 10 }, { antigenId: 12, quantity: 5 }], status: "출고완료", notes: "" },
  { id: 8, orderNo: "ORD-20260703-001", clientId: 5, orderDate: "2026-07-03", items: [{ antigenId: 5, quantity: 12 }, { antigenId: 6, quantity: 6 }],  status: "취소",    notes: "거래처 요청 취소" },
];

const INIT_HISTORY: HistoryRecord[] = [
  { id: 1,  date: "2026-07-09", type: "출고", antigenId: 1,  lotNo: "LOT-2501-HDM1-A", quantity: 5,  memo: "ORD-20260709-001", orderId: 1 },
  { id: 2,  date: "2026-07-08", type: "입고", antigenId: 1,  lotNo: "LOT-2508-HDM1-C", quantity: 30, memo: "정기 입고" },
  { id: 3,  date: "2026-07-08", type: "출고", antigenId: 4,  lotNo: "LOT-2503-CAT-A",  quantity: 4,  memo: "ORD-20260708-001", orderId: 3 },
  { id: 4,  date: "2026-07-07", type: "출고", antigenId: 7,  lotNo: "LOT-2505-MLK-A",  quantity: 10, memo: "ORD-20260707-001", orderId: 5 },
  { id: 5,  date: "2026-07-07", type: "출고", antigenId: 11, lotNo: "LOT-2507-WHT-A",  quantity: 5,  memo: "ORD-20260707-001", orderId: 5 },
  { id: 6,  date: "2026-07-06", type: "출고", antigenId: 3,  lotNo: "LOT-2503-DOG-A",  quantity: 8,  memo: "ORD-20260706-001", orderId: 6 },
  { id: 7,  date: "2026-07-05", type: "폐기", antigenId: 6,  lotNo: "LOT-2504-GRS-A",  quantity: 6,  memo: "유통기한 만료 폐기" },
  { id: 8,  date: "2026-07-04", type: "출고", antigenId: 10, lotNo: "LOT-2506-SHR-A",  quantity: 10, memo: "ORD-20260704-001", orderId: 7 },
  { id: 9,  date: "2026-07-03", type: "입고", antigenId: 8,  lotNo: "LOT-2508-EGG-B",  quantity: 20, memo: "정기 입고" },
  { id: 10, date: "2026-07-02", type: "입고", antigenId: 7,  lotNo: "LOT-2505-MLK-A",  quantity: 30, memo: "정기 입고" },
  { id: 11, date: "2026-07-01", type: "조정", antigenId: 9,  lotNo: "LOT-2506-PNT-A",  quantity: 2,  memo: "파손으로 인한 수량 조정" },
  { id: 12, date: "2026-06-30", type: "출고", antigenId: 12, lotNo: "LOT-2507-PCH-A",  quantity: 8,  memo: "ORD-20260630-001" },
  { id: 13, date: "2026-06-29", type: "입고", antigenId: 10, lotNo: "LOT-2506-SHR-A",  quantity: 24, memo: "정기 입고" },
  { id: 14, date: "2026-06-28", type: "폐기", antigenId: 12, lotNo: "LOT-2507-PCH-A",  quantity: 4,  memo: "유통기한 만료 폐기" },
  { id: 15, date: "2026-06-27", type: "입고", antigenId: 11, lotNo: "LOT-2507-WHT-A",  quantity: 12, memo: "정기 입고" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const todayDate = new Date(TODAY);

function daysUntil(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - todayDate.getTime()) / 86_400_000);
}

function fmtDate(d: string) { return d.replace(/-/g, "."); }

function getStatus(item: InventoryItem, antigen: Antigen): StockStatus {
  const days = daysUntil(item.expiryDate);
  if (days < 0)         return "유통기한 만료";
  if (item.quantity === 0) return "품절";
  if (days <= 30)       return "유통기한 임박";
  if (item.quantity < antigen.minStock) return "재고부족";
  return "정상";
}

function nextId(arr: { id: number }[]) {
  return arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// ─── Small shared components ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, string> = {
    "정상":        "bg-green-100 text-green-800 before:bg-green-500",
    "재고부족":    "bg-amber-100 text-amber-800 before:bg-amber-500",
    "품절":        "bg-red-100 text-red-800 before:bg-red-500",
    "유통기한 임박": "bg-orange-100 text-orange-800 before:bg-orange-500",
    "유통기한 만료": "bg-purple-100 text-purple-800 before:bg-purple-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${map[status]}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function OrderBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    "접수":    "bg-blue-100 text-blue-800",
    "준비중":  "bg-amber-100 text-amber-800",
    "출고완료": "bg-green-100 text-green-800",
    "취소":    "bg-gray-100 text-gray-500",
  };
  return <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${map[status]}`}>{status}</span>;
}

function HistBadge({ type }: { type: HistoryType }) {
  const map: Record<HistoryType, string> = {
    "입고": "bg-blue-100 text-blue-800",
    "출고": "bg-green-100 text-green-800",
    "조정": "bg-amber-100 text-amber-800",
    "폐기": "bg-red-100 text-red-800",
  };
  return <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${map[type]}`}>{type}</span>;
}

interface ModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({ open, title, message, confirmLabel = "확인", danger = false, onConfirm, onCancel }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
        <div className="flex items-start gap-4 mb-7">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${danger ? "bg-red-100" : "bg-blue-100"}`}>
            <AlertTriangle className={`w-6 h-6 ${danger ? "text-red-600" : "text-blue-600"}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-xl font-bold text-lg text-white transition-colors ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#1d51c8] hover:bg-[#1640a0]"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-500 text-base mt-1">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const MENU = [
  { id: "dashboard" as Page,  label: "대시보드",   icon: LayoutDashboard },
  { id: "inventory" as Page,  label: "재고현황",   icon: Package },
  { id: "receiving" as Page,  label: "입고등록",   icon: PackagePlus },
  { id: "orders"    as Page,  label: "주문관리",   icon: ClipboardList },
  { id: "dispatch"  as Page,  label: "출고처리",   icon: Truck },
  { id: "clients"   as Page,  label: "거래처관리", icon: Building2 },
  { id: "antigens"  as Page,  label: "항원관리",   icon: FlaskConical },
  { id: "history"   as Page,  label: "입출고이력", icon: History },
  { id: "settings"  as Page,  label: "설정",       icon: Settings },
];

function Sidebar({ current, pending, onNav }: { current: Page; pending: number; onNav: (p: Page) => void }) {
  return (
    <aside className="w-60 flex-shrink-0 bg-[#1b2a52] flex flex-col h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2563eb] rounded-xl flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">알러지 시약</div>
            <div className="text-blue-300 text-xs">재고관리시스템</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {MENU.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          const badge = id === "dispatch" && pending > 0;
          return (
            <button key={id} onClick={() => onNav(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-base transition-all ${
                active ? "bg-[#2563eb] text-white shadow-lg" : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-blue-400 text-xs">{fmtDate(TODAY)}</div>
        <div className="text-blue-100 text-sm font-semibold mt-0.5">관리자</div>
      </div>
    </aside>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, colorClass, onClick }: {
  label: string; value: number; unit: string; colorClass: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`${colorClass} rounded-2xl p-5 text-left transition-all hover:shadow-md hover:scale-[1.02] w-full`}>
      <div className="text-sm font-semibold opacity-80 mb-2">{label}</div>
      <div className="text-4xl font-bold leading-none">{value}</div>
      <div className="text-sm opacity-70 mt-1">{unit}</div>
    </button>
  );
}

function Dashboard({ inventory, orders, history, onNav }: {
  inventory: InventoryItem[]; orders: Order[]; history: HistoryRecord[]; onNav: (p: Page) => void;
}) {
  const enriched = useMemo(() => inventory.map(i => ({
    ...i, antigen: ANTIGENS.find(a => a.id === i.antigenId)!,
    status: getStatus(i, ANTIGENS.find(a => a.id === i.antigenId)!),
  })), [inventory]);

  const todayOrders  = orders.filter(o => o.orderDate === TODAY && o.status !== "취소").length;
  const pendingDisp  = orders.filter(o => o.status === "접수" || o.status === "준비중").length;
  const expiringSoon = [...new Set(enriched.filter(i => i.status === "유통기한 임박").map(i => i.antigenId))].length;
  const lowStock     = [...new Set(enriched.filter(i => i.status === "재고부족").map(i => i.antigenId))].length;
  const outOfStock   = [...new Set(enriched.filter(i => i.status === "품절").map(i => i.antigenId))].length;

  const tasks = [
    ...orders.filter(o => o.status === "접수").map(o => ({
      label: "출고대기",
      text: `${CLIENTS.find(c => c.id === o.clientId)?.name} — ${o.orderNo}`,
      cls: "bg-blue-50 border-blue-200 text-blue-800",
      tag: "bg-blue-100 text-blue-700",
    })),
    ...enriched.filter(i => i.status === "유통기한 임박").map(i => ({
      label: "유통기한 임박",
      text: `${i.antigen.name} · ${i.lotNo} (${daysUntil(i.expiryDate)}일 남음)`,
      cls: "bg-orange-50 border-orange-200 text-orange-800",
      tag: "bg-orange-100 text-orange-700",
    })),
    ...enriched.filter(i => i.status === "재고부족").map(i => ({
      label: "재고부족",
      text: `${i.antigen.name} · 현재 ${i.quantity}바이알`,
      cls: "bg-amber-50 border-amber-200 text-amber-800",
      tag: "bg-amber-100 text-amber-700",
    })),
  ];

  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 9);

  return (
    <div className="p-8">
      <SectionHeader title="대시보드" subtitle={`${fmtDate(TODAY)} 기준 현황`} />

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="오늘 주문"      value={todayOrders}  unit="건" colorClass="bg-blue-50 text-blue-900"   onClick={() => onNav("orders")} />
        <StatCard label="출고 대기"      value={pendingDisp}  unit="건" colorClass="bg-orange-50 text-orange-900" onClick={() => onNav("dispatch")} />
        <StatCard label="유통기한 30일 이내" value={expiringSoon} unit="종" colorClass="bg-amber-50 text-amber-900"  onClick={() => onNav("inventory")} />
        <StatCard label="재고 부족"      value={lowStock}     unit="종" colorClass="bg-yellow-50 text-yellow-900" onClick={() => onNav("inventory")} />
        <StatCard label="품절 항목"      value={outOfStock}   unit="종" colorClass="bg-red-50 text-red-900"     onClick={() => onNav("inventory")} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's tasks */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">오늘 처리할 일</h2>
            <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-full min-w-[28px] text-center">
              {tasks.length}
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <CheckCircle className="w-10 h-10 mb-2 text-green-400" />
                <span>처리할 항목이 없습니다</span>
              </div>
            ) : tasks.map((t, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${t.cls}`}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${t.tag}`}>{t.label}</span>
                <span className="text-sm font-medium leading-relaxed">{t.text}</span>
              </div>
            ))}
          </div>
          {pendingDisp > 0 && (
            <div className="px-4 pb-4">
              <button onClick={() => onNav("dispatch")}
                className="w-full py-3 bg-[#1d51c8] text-white font-bold rounded-xl hover:bg-[#1640a0] transition-colors flex items-center justify-center gap-2 text-base">
                출고처리 바로가기 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </Card>

        {/* Recent history */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">최근 입출고 이력</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-sm font-bold text-gray-500">날짜</th>
                <th className="text-left px-5 py-3 text-sm font-bold text-gray-500">구분</th>
                <th className="text-left px-5 py-3 text-sm font-bold text-gray-500">항원</th>
                <th className="text-right px-5 py-3 text-sm font-bold text-gray-500">수량</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(r => {
                const ant = ANTIGENS.find(a => a.id === r.antigenId);
                const isIn = r.type === "입고";
                return (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-600">{fmtDate(r.date)}</td>
                    <td className="px-5 py-3"><HistBadge type={r.type} /></td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-800 max-w-[130px] truncate">{ant?.name}</td>
                    <td className={`px-5 py-3 text-sm font-bold text-right ${isIn ? "text-blue-600" : "text-gray-600"}`}>
                      {isIn ? "+" : "−"}{r.quantity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function InventoryPage({ inventory }: { inventory: InventoryItem[] }) {
  const [antSearch, setAntSearch] = useState("");
  const [lotSearch, setLotSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "전체">("전체");
  const [expiryFilter, setExpiryFilter] = useState<"전체" | "30일" | "60일" | "만료">("전체");

  const enriched = useMemo(() => inventory.map(i => {
    const ant = ANTIGENS.find(a => a.id === i.antigenId)!;
    return { ...i, ant, status: getStatus(i, ant) };
  }), [inventory]);

  const filtered = useMemo(() => enriched.filter(i => {
    if (antSearch && !i.ant.name.includes(antSearch) && !i.ant.code.includes(antSearch.toUpperCase())) return false;
    if (lotSearch && !i.lotNo.toUpperCase().includes(lotSearch.toUpperCase())) return false;
    if (statusFilter !== "전체" && i.status !== statusFilter) return false;
    const days = daysUntil(i.expiryDate);
    if (expiryFilter === "30일" && days > 30) return false;
    if (expiryFilter === "60일" && days > 60) return false;
    if (expiryFilter === "만료" && days >= 0) return false;
    return true;
  }), [enriched, antSearch, lotSearch, statusFilter, expiryFilter]);

  return (
    <div className="p-8">
      <SectionHeader title="재고현황" subtitle={`전체 ${inventory.length}개 LOT · ${filtered.length}개 표시`} />

      <Card className="p-5 mb-5">
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={antSearch} onChange={e => setAntSearch(e.target.value)} placeholder="항원명 또는 코드 검색"
              className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors" />
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={lotSearch} onChange={e => setLotSearch(e.target.value)} placeholder="제조번호(LOT) 검색"
              className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] transition-colors" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] bg-white min-w-36">
            <option value="전체">전체 상태</option>
            <option value="정상">정상</option>
            <option value="재고부족">재고부족</option>
            <option value="품절">품절</option>
            <option value="유통기한 임박">유통기한 임박</option>
            <option value="유통기한 만료">유통기한 만료</option>
          </select>
          <select value={expiryFilter} onChange={e => setExpiryFilter(e.target.value as any)}
            className="px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] bg-white min-w-40">
            <option value="전체">유통기한 전체</option>
            <option value="30일">30일 이내 만료</option>
            <option value="60일">60일 이내 만료</option>
            <option value="만료">이미 만료</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["항원명", "코드", "제조번호 (LOT)", "재고 수량", "입고일", "유통기한", "상태"].map(h => (
                <th key={h} className={`px-6 py-4 text-sm font-bold text-gray-600 ${h === "재고 수량" || h === "상태" ? "text-center" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-14 text-gray-400 text-lg">검색 결과가 없습니다</td></tr>
            ) : filtered.map(item => {
              const days = daysUntil(item.expiryDate);
              const rowBg =
                item.status === "유통기한 만료" ? "bg-purple-50/40" :
                item.status === "품절"          ? "bg-red-50/30" :
                item.status === "유통기한 임박" ? "bg-orange-50/30" : "";
              return (
                <tr key={item.id} className={`border-t border-gray-100 ${rowBg} hover:brightness-[0.97] transition-all`}>
                  <td className="px-6 py-4 text-base font-semibold text-gray-900">{item.ant.name}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.ant.code}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">{item.lotNo}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xl font-bold ${item.quantity === 0 ? "text-red-600" : item.quantity < 5 ? "text-orange-600" : "text-gray-900"}`}>
                      {item.quantity}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">바이알</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{fmtDate(item.receivedDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                    {fmtDate(item.expiryDate)}
                    {days >= 0 && days <= 60 && (
                      <span className={`ml-1.5 text-xs font-bold ${days <= 30 ? "text-orange-600" : "text-amber-600"}`}>
                        ({days}일)
                      </span>
                    )}
                    {days < 0 && <span className="ml-1.5 text-xs font-bold text-red-600">({Math.abs(days)}일 초과)</span>}
                  </td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={item.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Receiving ────────────────────────────────────────────────────────────────

function ReceivingPage({ onAdd }: { onAdd: (item: Omit<InventoryItem, "id">, memo: string) => void }) {
  const [antigenId, setAntigenId] = useState(0);
  const [lotNo, setLotNo]         = useState("");
  const [quantity, setQuantity]   = useState("");
  const [recvDate, setRecvDate]   = useState(TODAY);
  const [expDate, setExpDate]     = useState("");
  const [memo, setMemo]           = useState("");
  const [confirm, setConfirm]     = useState(false);
  const [success, setSuccess]     = useState(false);

  const valid = antigenId > 0 && lotNo.trim() && Number(quantity) > 0 && expDate;
  const ant = ANTIGENS.find(a => a.id === antigenId);

  const doRegister = () => {
    onAdd({ antigenId, lotNo: lotNo.trim(), quantity: Number(quantity), receivedDate: recvDate, expiryDate: expDate }, memo.trim());
    setConfirm(false);
    setAntigenId(0); setLotNo(""); setQuantity(""); setExpDate(""); setMemo("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3500);
  };

  return (
    <div className="p-8">
      <SectionHeader title="입고 등록" subtitle="새로운 검사시약 입고 정보를 등록합니다" />

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-green-600 w-6 h-6 flex-shrink-0" />
          <span className="text-green-800 font-bold text-base">입고 등록이 완료되었습니다.</span>
        </div>
      )}

      <Card className="p-8 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">항원 선택 <span className="text-red-500">*</span></label>
            <select value={antigenId} onChange={e => setAntigenId(Number(e.target.value))}
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] bg-white">
              <option value={0}>항원을 선택하세요</option>
              {ANTIGENS.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-bold text-gray-700 mb-2">제조번호 (LOT) <span className="text-red-500">*</span></label>
              <input value={lotNo} onChange={e => setLotNo(e.target.value)} placeholder="예: LOT-2601-HDM1-A"
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base font-mono focus:outline-none focus:border-[#2563eb]" />
            </div>
            <div>
              <label className="block text-base font-bold text-gray-700 mb-2">수량 (바이알) <span className="text-red-500">*</span></label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="예: 24" min={1}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-bold text-gray-700 mb-2">입고일 <span className="text-red-500">*</span></label>
              <input type="date" value={recvDate} onChange={e => setRecvDate(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb]" />
            </div>
            <div>
              <label className="block text-base font-bold text-gray-700 mb-2">유통기한 <span className="text-red-500">*</span></label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb]" />
            </div>
          </div>

          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">메모</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="특이사항이 있으면 입력하세요"
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] resize-none" />
          </div>

          <button onClick={() => setConfirm(true)} disabled={!valid}
            className="w-full py-4 bg-[#1d51c8] text-white text-lg font-bold rounded-xl hover:bg-[#1640a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            입고 등록
          </button>
        </div>
      </Card>

      <ConfirmModal open={confirm} title="입고 등록 확인"
        message={`항원: ${ant?.name}\n제조번호: ${lotNo}\n수량: ${quantity}바이알\n유통기한: ${fmtDate(expDate)}\n\n위 내용으로 등록하시겠습니까?`}
        confirmLabel="입고 등록" onConfirm={doRegister} onCancel={() => setConfirm(false)} />
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function OrdersPage({ orders, onAdd, onGoDispatch }: {
  orders: Order[];
  onAdd: (o: Omit<Order, "id" | "orderNo">) => void;
  onGoDispatch: () => void;
}) {
  const [clientQ, setClientQ] = useState("");
  const [statusF, setStatusF] = useState<OrderStatus | "전체">("전체");
  const [modal, setModal]     = useState(false);

  const [nClient, setNClient] = useState(0);
  const [nItems, setNItems]   = useState<OrderItem[]>([{ antigenId: 0, quantity: 1 }]);
  const [nNotes, setNNotes]   = useState("");

  const filtered = useMemo(() =>
    orders.filter(o => {
      const c = CLIENTS.find(cl => cl.id === o.clientId);
      if (clientQ && !c?.name.includes(clientQ)) return false;
      if (statusF !== "전체" && o.status !== statusF) return false;
      return true;
    }).sort((a, b) => b.orderDate.localeCompare(a.orderDate)),
    [orders, clientQ, statusF]);

  const registerValid = nClient > 0 && nItems.every(i => i.antigenId > 0 && i.quantity > 0);

  const doAdd = () => {
    onAdd({ clientId: nClient, orderDate: TODAY, items: nItems, status: "접수", notes: nNotes });
    setModal(false); setNClient(0); setNItems([{ antigenId: 0, quantity: 1 }]); setNNotes("");
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-gray-500 text-base mt-1">전체 {orders.length}건 · {filtered.length}건 표시</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-6 py-3.5 bg-[#1d51c8] text-white text-base font-bold rounded-xl hover:bg-[#1640a0] transition-colors">
          <Plus className="w-5 h-5" /> 주문 등록
        </button>
      </div>

      <Card className="p-5 mb-5">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input value={clientQ} onChange={e => setClientQ(e.target.value)} placeholder="거래처명 검색"
              className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb]" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["전체", "접수", "준비중", "출고완료", "취소"] as const).map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                className={`px-5 py-3.5 rounded-xl text-base font-semibold transition-colors ${statusF === s ? "bg-[#1d51c8] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["주문번호", "거래처", "주문일", "주문 항목", "비고", "상태", "처리"].map(h => (
                <th key={h} className={`px-6 py-4 text-sm font-bold text-gray-600 ${h === "상태" || h === "처리" ? "text-center" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-14 text-gray-400 text-lg">주문이 없습니다</td></tr>
            ) : filtered.map(o => {
              const client = CLIENTS.find(c => c.id === o.clientId);
              const summary = o.items.map(i => {
                const a = ANTIGENS.find(ag => ag.id === i.antigenId);
                return `${a?.name.split("(")[0].trim()} ×${i.quantity}`;
              }).join(" / ");
              return (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-700">{o.orderNo}</td>
                  <td className="px-6 py-4 text-base font-bold text-gray-900">{client?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{fmtDate(o.orderDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">{summary}</td>
                  <td className="px-6 py-4 text-sm">
                    {o.notes && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg font-semibold text-xs">{o.notes}</span>}
                  </td>
                  <td className="px-6 py-4 text-center"><OrderBadge status={o.status} /></td>
                  <td className="px-6 py-4 text-center">
                    {(o.status === "접수" || o.status === "준비중") && (
                      <button onClick={onGoDispatch}
                        className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors">
                        출고 처리
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Register modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-8 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">주문 등록</h3>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">거래처 <span className="text-red-500">*</span></label>
                <select value={nClient} onChange={e => setNClient(Number(e.target.value))}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] bg-white">
                  <option value={0}>거래처를 선택하세요</option>
                  {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">주문 항목 <span className="text-red-500">*</span></label>
                <div className="space-y-3">
                  {nItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <select value={item.antigenId}
                        onChange={e => { const u = [...nItems]; u[idx].antigenId = Number(e.target.value); setNItems(u); }}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb] bg-white">
                        <option value={0}>항원 선택</option>
                        {ANTIGENS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <input type="number" value={item.quantity} min={1}
                        onChange={e => { const u = [...nItems]; u[idx].quantity = Number(e.target.value); setNItems(u); }}
                        className="w-20 px-3 py-3 border-2 border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-[#2563eb]" />
                      <span className="text-sm text-gray-500 flex-shrink-0">바이알</span>
                      {nItems.length > 1 && (
                        <button onClick={() => setNItems(nItems.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setNItems([...nItems, { antigenId: 0, quantity: 1 }])}
                    className="flex items-center gap-1.5 text-[#2563eb] text-sm font-semibold hover:underline">
                    <Plus className="w-4 h-4" /> 항목 추가
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">메모</label>
                <textarea value={nNotes} onChange={e => setNNotes(e.target.value)} rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb] resize-none"
                  placeholder="특이사항 입력 (예: 긴급)" />
              </div>
              <button onClick={doAdd} disabled={!registerValid}
                className="w-full py-4 bg-[#1d51c8] text-white text-lg font-bold rounded-xl hover:bg-[#1640a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                주문 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function DispatchPage({ orders, inventory, onDispatch }: {
  orders: Order[]; inventory: InventoryItem[]; onDispatch: (id: number) => void;
}) {
  const [selId, setSelId]   = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  const pending = orders
    .filter(o => o.status === "접수" || o.status === "준비중")
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate));

  const sel     = selId ? orders.find(o => o.id === selId) : null;
  const selClient = sel ? CLIENTS.find(c => c.id === sel.clientId) : null;

  const lotsFor = (antigenId: number) =>
    inventory.filter(i => i.antigenId === antigenId && i.quantity > 0)
             .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const doDispatch = () => {
    if (!selId) return;
    onDispatch(selId);
    setConfirm(false);
    setSelId(null);
  };

  return (
    <div className="p-8">
      <SectionHeader title="출고 처리" subtitle={`출고 대기 ${pending.length}건`} />

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left panel */}
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-3">출고 대기 주문</h2>
          {pending.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">출고 대기 주문이 없습니다</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map(o => {
                const client = CLIENTS.find(c => c.id === o.clientId);
                const active = selId === o.id;
                return (
                  <button key={o.id} onClick={() => setSelId(o.id)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${active ? "border-[#2563eb] bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-blue-300"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-base font-bold text-gray-900">{client?.name}</div>
                        <div className="text-sm font-mono text-gray-500">{o.orderNo}</div>
                      </div>
                      <OrderBadge status={o.status} />
                    </div>
                    <div className="text-sm text-gray-500">주문일: {fmtDate(o.orderDate)} · {o.items.length}개 항목</div>
                    {o.notes && (
                      <span className="mt-2 inline-block text-xs font-bold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg">{o.notes}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-3">주문 상세 · LOT 배정</h2>
          {!sel ? (
            <Card className="p-14 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-4 text-gray-200">←</div>
              <p className="text-gray-400 text-lg">왼쪽에서 주문을 선택하세요</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-gray-900">{selClient?.name}</div>
                  <div className="text-sm font-mono text-gray-500">{sel.orderNo}</div>
                </div>
                <OrderBadge status={sel.status} />
              </div>

              <div className="p-6 space-y-5">
                {sel.items.map((oi, idx) => {
                  const ant  = ANTIGENS.find(a => a.id === oi.antigenId);
                  const lots = lotsFor(oi.antigenId);
                  const avail = lots.reduce((s, l) => s + l.quantity, 0);
                  const short = avail < oi.quantity;
                  return (
                    <div key={idx} className={`p-4 rounded-xl border-2 ${short ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-base font-bold text-gray-900">{ant?.name}</div>
                          <div className="text-sm text-gray-500">주문 수량: <span className="font-bold text-gray-800">{oi.quantity}바이알</span></div>
                        </div>
                        {short && (
                          <div className="flex items-center gap-1.5 text-red-700 bg-red-100 px-3 py-2 rounded-lg text-sm font-bold">
                            <AlertTriangle className="w-4 h-4" /> 재고 부족
                          </div>
                        )}
                      </div>
                      {lots.length === 0 ? (
                        <p className="text-red-600 text-sm font-bold">사용 가능한 재고 없음</p>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">유통기한 빠른 순 추천 LOT</p>
                          <div className="space-y-2">
                            {lots.map((lot, li) => {
                              const days = daysUntil(lot.expiryDate);
                              return (
                                <div key={lot.id}
                                  className={`flex items-center justify-between px-4 py-3 rounded-lg border ${days <= 30 ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-white"}`}>
                                  <div>
                                    {li === 0 && <span className="text-xs font-bold text-blue-600 mr-2">▶ 1순위</span>}
                                    <span className="text-sm font-mono font-semibold text-gray-800">{lot.lotNo}</span>
                                    <div className="text-xs text-gray-500 mt-0.5">유통기한 {fmtDate(lot.expiryDate)} · {days}일 남음</div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-lg font-bold ${lot.quantity < oi.quantity ? "text-orange-600" : "text-gray-900"}`}>{lot.quantity}개</div>
                                    {days <= 30 && <div className="text-xs text-orange-600 font-bold">임박!</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-4 border-t border-gray-100">
                <button onClick={() => setConfirm(true)}
                  className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                  <Truck className="w-5 h-5" /> 출고 완료 처리
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal open={confirm} title="출고 처리 확인" danger
        message={`거래처: ${selClient?.name}\n주문번호: ${sel?.orderNo}\n\n출고 완료 처리합니다.\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`}
        confirmLabel="출고 완료" onConfirm={doDispatch} onCancel={() => setConfirm(false)} />
    </div>
  );
}

// ─── Clients ──────────────────────────────────────────────────────────────────

function ClientsPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <SectionHeader title="거래처 관리" subtitle={`총 ${CLIENTS.length}개 거래처`} />
        <button className="flex items-center gap-2 px-6 py-3.5 bg-[#1d51c8] text-white text-base font-bold rounded-xl hover:bg-[#1640a0] transition-colors">
          <Plus className="w-5 h-5" /> 거래처 등록
        </button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["거래처명", "담당자", "연락처", "주소"].map(h => (
                <th key={h} className="text-left px-6 py-4 text-sm font-bold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map(c => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-base font-bold text-gray-900">{c.name}</td>
                <td className="px-6 py-4 text-base text-gray-700">{c.contactPerson}</td>
                <td className="px-6 py-4 text-base font-mono text-gray-700">{c.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Antigens ─────────────────────────────────────────────────────────────────

function AntigensPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <SectionHeader title="항원 관리" subtitle={`총 ${ANTIGENS.length}개 항원`} />
        <button className="flex items-center gap-2 px-6 py-3.5 bg-[#1d51c8] text-white text-base font-bold rounded-xl hover:bg-[#1640a0] transition-colors">
          <Plus className="w-5 h-5" /> 항원 등록
        </button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["코드", "항원명", "분류", "최소 재고 기준"].map(h => (
                <th key={h} className={`px-6 py-4 text-sm font-bold text-gray-600 ${h === "최소 재고 기준" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ANTIGENS.map(a => (
              <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono font-bold text-gray-500">{a.code}</td>
                <td className="px-6 py-4 text-base font-semibold text-gray-900">{a.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${a.category === "흡입성" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {a.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-base font-bold text-gray-700">{a.minStock}바이알</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryPage({ history }: { history: HistoryRecord[] }) {
  const [from, setFrom]       = useState("2026-06-01");
  const [to, setTo]           = useState(TODAY);
  const [antQ, setAntQ]       = useState("");
  const [lotQ, setLotQ]       = useState("");
  const [typeF, setTypeF]     = useState<HistoryType | "전체">("전체");

  const filtered = useMemo(() =>
    history.filter(r => {
      if (r.date < from || r.date > to) return false;
      const ant = ANTIGENS.find(a => a.id === r.antigenId);
      if (antQ && !ant?.name.includes(antQ)) return false;
      if (lotQ && !r.lotNo.toUpperCase().includes(lotQ.toUpperCase())) return false;
      if (typeF !== "전체" && r.type !== typeF) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date)),
    [history, from, to, antQ, lotQ, typeF]);

  return (
    <div className="p-8">
      <SectionHeader title="입출고 이력" subtitle={`전체 ${history.length}건 · ${filtered.length}건 표시`} />

      <Card className="p-5 mb-5">
        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-600 whitespace-nowrap">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb]" />
            <span className="text-gray-400 font-bold">~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb]" />
          </div>
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input value={antQ} onChange={e => setAntQ(e.target.value)} placeholder="항원명 검색"
              className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb]" />
          </div>
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input value={lotQ} onChange={e => setLotQ(e.target.value)} placeholder="LOT번호 검색"
              className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563eb]" />
          </div>
          <div className="flex gap-2">
            {(["전체", "입고", "출고", "조정", "폐기"] as const).map(t => (
              <button key={t} onClick={() => setTypeF(t)}
                className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${typeF === t ? "bg-[#1d51c8] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["날짜", "구분", "항원명", "제조번호 (LOT)", "수량", "메모"].map(h => (
                <th key={h} className={`px-6 py-4 text-sm font-bold text-gray-600 ${h === "수량" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-14 text-gray-400 text-lg">이력이 없습니다</td></tr>
            ) : filtered.map(r => {
              const ant  = ANTIGENS.find(a => a.id === r.antigenId);
              const isIn = r.type === "입고";
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">{fmtDate(r.date)}</td>
                  <td className="px-6 py-4"><HistBadge type={r.type} /></td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{ant?.name}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{r.lotNo}</td>
                  <td className={`px-6 py-4 text-right text-base font-bold ${isIn ? "text-blue-600" : "text-gray-700"}`}>
                    {isIn ? "+" : "−"}{r.quantity}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };
  return (
    <div className="p-8">
      <SectionHeader title="설정" subtitle="시스템 기본 정보와 알림 기준을 설정합니다" />
      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-green-600 w-6 h-6 flex-shrink-0" />
          <span className="text-green-800 font-bold text-base">설정이 저장되었습니다.</span>
        </div>
      )}
      <Card className="p-8 max-w-xl">
        <div className="space-y-6">
          {[
            { label: "회사/기관명",            def: "○○ 의료기기 주식회사", type: "text" },
            { label: "시스템 관리자",           def: "관리자",              type: "text" },
            { label: "유통기한 임박 알림 기준 (일)", def: "30",             type: "number" },
            { label: "재고부족 기본 임계값 (바이알)", def: "10",            type: "number" },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-base font-bold text-gray-700 mb-2">{f.label}</label>
              <input type={f.type} defaultValue={f.def}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2563eb]" />
            </div>
          ))}
          <button onClick={save}
            className="w-full py-4 bg-[#1d51c8] text-white text-lg font-bold rounded-xl hover:bg-[#1640a0] transition-colors">
            저장
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]           = useState<Page>("dashboard");
  const [inventory, setInventory] = useState<InventoryItem[]>(INIT_INVENTORY);
  const [orders, setOrders]       = useState<Order[]>(INIT_ORDERS);
  const [history, setHistory]     = useState<HistoryRecord[]>(INIT_HISTORY);

  const pending = orders.filter(o => o.status === "접수" || o.status === "준비중").length;

  const addInventory = (item: Omit<InventoryItem, "id">, memo: string) => {
    const newItem: InventoryItem = { ...item, id: nextId(inventory) };
    setInventory(prev => [...prev, newItem]);
    setHistory(prev => [...prev, {
      id: nextId(prev), date: TODAY, type: "입고",
      antigenId: item.antigenId, lotNo: item.lotNo,
      quantity: item.quantity, memo: memo || "입고 등록",
    }]);
  };

  const addOrder = (o: Omit<Order, "id" | "orderNo">) => {
    const id = nextId(orders);
    setOrders(prev => [...prev, {
      ...o, id,
      orderNo: `ORD-${TODAY.replace(/-/g, "")}-${String(id).padStart(3, "0")}`,
    }]);
  };

  const dispatchOrder = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "출고완료" as OrderStatus } : o));

    setInventory(prev => {
      const updated = [...prev];
      order.items.forEach(oi => {
        let rem = oi.quantity;
        updated
          .filter(i => i.antigenId === oi.antigenId && i.quantity > 0)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
          .forEach(lot => {
            if (rem <= 0) return;
            const idx = updated.findIndex(i => i.id === lot.id);
            const take = Math.min(rem, updated[idx].quantity);
            updated[idx] = { ...updated[idx], quantity: updated[idx].quantity - take };
            rem -= take;
          });
      });
      return updated;
    });

    const base = nextId(history);
    const newRecs: HistoryRecord[] = order.items.map((oi, i) => ({
      id: base + i, date: TODAY, type: "출고" as HistoryType,
      antigenId: oi.antigenId, lotNo: "FIFO 자동 배정",
      quantity: oi.quantity, memo: order.orderNo, orderId,
    }));
    setHistory(prev => [...prev, ...newRecs]);
  };

  const render = () => {
    switch (page) {
      case "dashboard": return <Dashboard inventory={inventory} orders={orders} history={history} onNav={setPage} />;
      case "inventory": return <InventoryPage inventory={inventory} />;
      case "receiving": return <ReceivingPage onAdd={addInventory} />;
      case "orders":    return <OrdersPage orders={orders} onAdd={addOrder} onGoDispatch={() => setPage("dispatch")} />;
      case "dispatch":  return <DispatchPage orders={orders} inventory={inventory} onDispatch={dispatchOrder} />;
      case "clients":   return <ClientsPage />;
      case "antigens":  return <AntigensPage />;
      case "history":   return <HistoryPage history={history} />;
      case "settings":  return <SettingsPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar current={page} pending={pending} onNav={setPage} />
      <main className="flex-1 overflow-y-auto bg-[#edf1f8]">
        {render()}
      </main>
    </div>
  );
}
