import type { WarehouseKind } from "@/domain/warehouse";

export type LotStatus = "정상" | "재고부족" | "품절" | "유통기한 임박" | "유통기한 만료";
export type OrderStatus = "접수" | "준비중" | "출고완료" | "취소";
export type MovementType = "입고" | "출고" | "조정" | "폐기" | "창고이동";

export type Allergen = {
  id: number;
  code: string;
  name: string;
  category: string;
  minStock: number;
  active: boolean;
};

export type Lot = {
  id: number;
  allergenId: number;
  lotNo: string;
  quantity: number;
  warehouse: WarehouseKind;
  receivedDate: string;
  expirationDate: string;
};

export type Client = {
  id: number;
  name: string;
  manager: string;
  region: string;
  deliveryDepartment: string;
};

export type Order = {
  id: number;
  orderNo: string;
  clientId: number;
  orderDate: string;
  items: Array<{ allergenId: number; quantity: number }>;
  status: OrderStatus;
  memo: string;
};

export type Movement = {
  id: number;
  date: string;
  type: MovementType;
  allergenId: number;
  lotNo: string;
  quantity: number;
  memo: string;
  warehouse?: WarehouseKind;
  destinationWarehouse?: WarehouseKind;
};

export const today = koreaDateKey();

export const allergens: Allergen[] = [
  { id: 1, code: "HDM-D1", name: "집먼지 진드기 D.pteronyssinus", category: "흡입성", minStock: 10, active: true },
  { id: 2, code: "HDM-D2", name: "집먼지 진드기 D.farinae", category: "흡입성", minStock: 10, active: true },
  { id: 3, code: "DOG-01", name: "개 비듬", category: "흡입성", minStock: 8, active: true },
  { id: 4, code: "CAT-01", name: "고양이 비듬", category: "흡입성", minStock: 8, active: true },
  { id: 5, code: "GRS-01", name: "잔디 꽃가루 혼합", category: "흡입성", minStock: 6, active: true },
  { id: 6, code: "MLK-01", name: "우유", category: "식품성", minStock: 12, active: true },
  { id: 7, code: "EGG-01", name: "난백", category: "식품성", minStock: 12, active: true },
  { id: 8, code: "PNT-01", name: "땅콩", category: "식품성", minStock: 10, active: true },
  { id: 9, code: "SHR-01", name: "새우", category: "식품성", minStock: 8, active: true },
  { id: 10, code: "WHT-01", name: "밀가루", category: "식품성", minStock: 10, active: true }
];

export const lots: Lot[] = [
  { id: 1, allergenId: 1, lotNo: "LOT-2501-HDM1-A", quantity: 18, warehouse: "FINISHED_GOODS", receivedDate: "2025-01-15", expirationDate: "2027-03-15" },
  { id: 2, allergenId: 1, lotNo: "LOT-2501-HDM1-B", quantity: 4, warehouse: "FINISHED_GOODS", receivedDate: "2025-01-20", expirationDate: "2026-07-25" },
  { id: 3, allergenId: 2, lotNo: "LOT-2502-HDM2-A", quantity: 0, warehouse: "FINISHED_GOODS", receivedDate: "2025-02-10", expirationDate: "2026-12-10" },
  { id: 4, allergenId: 3, lotNo: "LOT-2503-DOG-A", quantity: 22, warehouse: "FINISHED_GOODS", receivedDate: "2025-03-05", expirationDate: "2027-06-20" },
  { id: 5, allergenId: 4, lotNo: "LOT-2503-CAT-A", quantity: 3, warehouse: "FINISHED_GOODS", receivedDate: "2025-03-10", expirationDate: "2026-07-18" },
  { id: 6, allergenId: 5, lotNo: "LOT-2504-GRS-A", quantity: 0, warehouse: "FINISHED_GOODS", receivedDate: "2025-04-15", expirationDate: "2026-06-15" },
  { id: 7, allergenId: 6, lotNo: "LOT-2505-MLK-A", quantity: 28, warehouse: "FINISHED_GOODS", receivedDate: "2025-05-20", expirationDate: "2027-09-01" },
  { id: 8, allergenId: 7, lotNo: "LOT-2508-EGG-B", quantity: 6, warehouse: "FINISHED_GOODS", receivedDate: "2026-07-03", expirationDate: "2026-09-15" },
  { id: 9, allergenId: 8, lotNo: "LOT-2506-PNT-A", quantity: 2, warehouse: "FINISHED_GOODS", receivedDate: "2025-06-10", expirationDate: "2026-08-05" },
  { id: 10, allergenId: 9, lotNo: "LOT-2506-SHR-A", quantity: 14, warehouse: "FINISHED_GOODS", receivedDate: "2025-06-29", expirationDate: "2027-05-22" },
  { id: 11, allergenId: 10, lotNo: "LOT-2507-WHT-A", quantity: 5, warehouse: "FINISHED_GOODS", receivedDate: "2025-07-15", expirationDate: "2026-07-30" }
];

export const clients: Client[] = [
  { id: 1, name: "서울대학교병원", manager: "김정호", region: "서울 종로구", deliveryDepartment: "진단검사의학과" },
  { id: 2, name: "삼성서울병원", manager: "이수진", region: "서울 강남구", deliveryDepartment: "알레르기내과" },
  { id: 3, name: "서울아산병원", manager: "박민재", region: "서울 송파구", deliveryDepartment: "소아청소년과" },
  { id: 4, name: "세브란스병원", manager: "최동훈", region: "서울 서대문구", deliveryDepartment: "호흡기내과" },
  { id: 5, name: "고려대학교의료원", manager: "정하늘", region: "서울 성북구", deliveryDepartment: "진단검사의학과" },
  { id: 6, name: "분당서울대학교병원", manager: "윤서연", region: "경기 성남시", deliveryDepartment: "알레르기내과" },
  { id: 7, name: "인하대학교병원", manager: "한지민", region: "인천 미추홀구", deliveryDepartment: "소아청소년과" }
];

export const orders: Order[] = [
  { id: 1, orderNo: "ORD-20260709-001", clientId: 1, orderDate: "2026-07-09", items: [{ allergenId: 1, quantity: 5 }, { allergenId: 7, quantity: 3 }], status: "접수", memo: "" },
  { id: 2, orderNo: "ORD-20260709-002", clientId: 4, orderDate: "2026-07-09", items: [{ allergenId: 7, quantity: 5 }, { allergenId: 2, quantity: 4 }], status: "접수", memo: "긴급" },
  { id: 3, orderNo: "ORD-20260708-001", clientId: 2, orderDate: "2026-07-08", items: [{ allergenId: 4, quantity: 4 }, { allergenId: 8, quantity: 6 }], status: "준비중", memo: "" },
  { id: 4, orderNo: "ORD-20260707-001", clientId: 3, orderDate: "2026-07-07", items: [{ allergenId: 6, quantity: 10 }, { allergenId: 10, quantity: 5 }], status: "출고완료", memo: "" },
  { id: 5, orderNo: "ORD-20260703-001", clientId: 5, orderDate: "2026-07-03", items: [{ allergenId: 5, quantity: 12 }], status: "취소", memo: "거래처 요청" }
];

export const movements: Movement[] = [
  { id: 1, date: "2026-07-09", type: "출고", allergenId: 1, lotNo: "LOT-2501-HDM1-A", quantity: 5, memo: "ORD-20260709-001" },
  { id: 2, date: "2026-07-08", type: "입고", allergenId: 1, lotNo: "LOT-2508-HDM1-C", quantity: 30, memo: "정기 입고" },
  { id: 3, date: "2026-07-08", type: "출고", allergenId: 4, lotNo: "LOT-2503-CAT-A", quantity: 4, memo: "ORD-20260708-001" },
  { id: 4, date: "2026-07-07", type: "출고", allergenId: 6, lotNo: "LOT-2505-MLK-A", quantity: 10, memo: "ORD-20260707-001" },
  { id: 5, date: "2026-07-05", type: "폐기", allergenId: 5, lotNo: "LOT-2504-GRS-A", quantity: 6, memo: "유통기한 만료" },
  { id: 6, date: "2026-07-01", type: "조정", allergenId: 8, lotNo: "LOT-2506-PNT-A", quantity: 2, memo: "실사 차이 보정" }
];

export function formatDate(value: string) {
  return value.replaceAll("-", ".");
}

export function findAllergen(id: number) {
  return allergens.find((allergen) => allergen.id === id);
}

export function findClient(id: number) {
  return clients.find((client) => client.id === id);
}

export function daysUntil(date: string) {
  return daysUntilDateOnly(date);
}

export function lotStatus(lot: Lot): LotStatus {
  const allergen = findAllergen(lot.allergenId);
  const days = daysUntil(lot.expirationDate);

  if (days < 0) return "유통기한 만료";
  if (lot.quantity === 0) return "품절";
  if (days <= 30) return "유통기한 임박";
  if (allergen && lot.quantity < allergen.minStock) return "재고부족";
  return "정상";
}

export function orderItemSummary(order: Order) {
  return order.items
    .map((item) => `${findAllergen(item.allergenId)?.code ?? "-"} ${item.quantity}`)
    .join(", ");
}

export const dashboard = {
  todayOrders: orders.filter((order) => order.orderDate === today).length,
  pendingShipments: orders.filter((order) => order.status === "접수" || order.status === "준비중").length,
  todayShipments: movements.filter((movement) => movement.date === today && movement.type === "출고").length,
  expiringLots: lots.filter((lot) => {
    const days = daysUntil(lot.expirationDate);
    return days >= 0 && days <= 30;
  }).length,
  lowLots: lots.filter((lot) => ["재고부족", "품절"].includes(lotStatus(lot))).length
};
import { daysUntilDateOnly, koreaDateKey } from "@/lib/date";
