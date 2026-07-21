# 데이터 모델 설계서

## 1. 설계 원칙

재고는 항원 단위가 아니라 LOT와 창고의 조합으로 관리한다. `ReagentLot`은 제조번호·유통기한 등 LOT 정체성을 보관하고, 변경 가능한 현재 수량의 단일 원천은 `WarehouseStock.quantity`이다.

LOT는 다음 값의 조합으로 식별한다.

```text
항원ID + 제조번호 + 유통기한
```

이 조합은 중복될 수 없도록 관리한다.

## 2. 주요 엔티티

### 2.1 사용자 User

| 필드 | 설명 |
|---|---|
| id | 사용자 ID |
| loginId | 로그인 아이디 |
| email | 이메일 또는 연락처용 이메일 |
| name | 사용자 이름 |
| passwordHash | 암호화된 비밀번호 |
| role | 사용자 역할 |
| isActive | 사용 여부 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

### 2.2 항원 Allergen

| 필드 | 설명 |
|---|---|
| id | 항원 ID |
| code | 항원 코드 |
| name | 항원명 |
| category | 분류 |
| isActive | 사용 여부 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

### 2.3 LOT 재고 ReagentLot

| 필드 | 설명 |
|---|---|
| id | LOT ID |
| allergenId | 항원 ID |
| lotNo | 제조번호 |
| expirationDate | 유통기한 |
| receivedDate | 입고일 |
| initialQuantity | 최초 입고수량 |
| memo | 메모 |
| isActive | 사용 여부 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

### 2.4 창고재고 WarehouseStock

| 필드 | 설명 |
|---|---|
| reagentLotId | LOT ID, 복합 기본키 |
| warehouse | 창고, 복합 기본키 |
| quantity | 해당 LOT·창고의 현재 수량 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

동일 LOT은 여러 창고에 나뉘어 보관할 수 있지만 `(reagentLotId, warehouse)` 행은 하나만 존재한다. 수량이 0이 된 행도 이력과 조회의 일관성을 위해 유지할 수 있다.

### 2.5 거래처 Client

| 필드 | 설명 |
|---|---|
| id | 거래처 ID |
| name | 거래처명 |
| managerName | 담당자명 |
| phone | 연락처 |
| address | 주소 |
| memo | 메모 |
| isActive | 사용 여부 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

### 2.6 주문 Order

| 필드 | 설명 |
|---|---|
| id | 주문 ID |
| orderNo | 주문번호 |
| clientId | 거래처 ID |
| status | 주문 상태 |
| memo | 메모 |
| createdBy | 등록자 ID |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |

### 2.6.1 주문 이미지 OrderImage

| 필드 | 설명 |
|---|---|
| id | 주문 이미지 ID |
| orderId | 주문 ID, 주문당 1개로 제한 |
| fileName | 정규화된 표시용 원본 파일명 |
| contentType | 검증된 MIME 유형(JPEG/PNG/WebP) |
| byteSize | 이미지 바이트 크기, 최대 3MB |
| data | 인증 경로에서만 제공하는 이미지 원본 바이트 |
| createdAt | 생성일시 |

### 2.7 주문상세 OrderItem

| 필드 | 설명 |
|---|---|
| id | 주문상세 ID |
| orderId | 주문 ID |
| allergenId | 항원 ID |
| quantity | 주문수량 |

### 2.8 출고 Shipment

| 필드 | 설명 |
|---|---|
| id | 출고 ID |
| orderId | 주문 ID |
| status | 출고 상태 |
| shippedBy | 출고 처리자 ID |
| shippedAt | 출고일시 |
| memo | 메모 |

### 2.9 출고상세 ShipmentItem

| 필드 | 설명 |
|---|---|
| id | 출고상세 ID |
| shipmentId | 출고 ID |
| reagentLotId | 실제 출고된 LOT ID |
| allergenId | 항원 ID |
| quantity | 출고수량 |

### 2.10 재고이동 StockMovement

| 필드 | 설명 |
|---|---|
| id | 재고이동 ID |
| reagentLotId | LOT ID |
| type | 이동 유형 |
| quantity | 변경수량 |
| warehouse | 발생 창고. `TRANSFER`에서는 출발 창고 |
| destinationWarehouse | `TRANSFER`의 도착 창고, 그 외에는 null |
| reason | 사유 |
| refType | 참조 유형 |
| refId | 참조 ID |
| createdBy | 처리자 ID |
| createdAt | 처리일시 |

### 2.11 감사 로그 AuditLog

| 필드 | 설명 |
|---|---|
| id | 감사 로그 ID |
| action | 수행 작업 코드 |
| entityType | 대상 엔티티 유형 |
| entityId | 대상 엔티티 ID. 범용 문자열이며 직접 외래 키는 아님 |
| description | 작업 설명 |
| actorId | 처리자 ID |
| createdAt | 처리일시 |

## 3. 상태 값

### 사용자 역할

| 값 | 설명 |
|---|---|
| ADMIN | 관리자 |
| ORDER_MANAGER | 주문관리 담당자 |
| SHIPMENT_MANAGER | 출고 담당자 |
| VIEWER | 조회 사용자 |

### 주문 상태

| 값 | 설명 |
|---|---|
| RECEIVED | 접수 |
| READY_TO_SHIP | 출고대기 |
| SHIPPED | 출고완료 |
| CANCELLED | 취소 |

### 출고 상태

| 값 | 설명 |
|---|---|
| SHIPPED | 출고완료 |
| CANCELLED | 취소 |

### 재고이동 유형

| 값 | 설명 |
|---|---|
| IN | 입고 |
| OUT | 출고 |
| ADJUST | 조정 |
| DISPOSE | 폐기 |
| REVERSE | 취소/복구 |
| TRANSFER | 창고 간 이동. 전체 수량 증감은 0 |

### 창고

| 값 | 설명 |
|---|---|
| FINISHED_GOODS | 완제품 |
| SAMPLE | 검체 |
| RETURNED | 반품 |
| NONCONFORMING | 부적합 |
| DISPOSAL | 폐기 |

## 4. 주요 제약조건

| 제약조건 | 설명 |
|---|---|
| Allergen.code unique | 항원 코드는 중복 불가 |
| User.loginId unique | 사용자 로그인 아이디 중복 불가 |
| Order.orderNo unique | 주문번호 중복 불가 |
| OrderImage.orderId unique | 주문당 첨부 이미지 1개 |
| OrderImage 검증 제약 | JPEG/PNG/WebP, 1~3MB, 메타 크기와 실제 바이트 크기 일치 |
| ReagentLot unique | allergenId + lotNo + expirationDate 중복 불가 |
| WarehouseStock primary key | reagentLotId + warehouse 중복 불가 |
| WarehouseStock.quantity >= 0 | 창고별 재고 음수 불가 |
| TRANSFER shape | 양의 수량, 서로 다른 출발·도착 창고 필수 |
| non-TRANSFER destination | `TRANSFER` 외 이력의 destinationWarehouse는 null |

## 5. 주요 인덱스

| 테이블 | 인덱스 대상 | 목적 |
|---|---|---|
| Allergen | name | 항원명 검색 |
| ReagentLot | lotNo | 제조번호 검색 |
| ReagentLot | expirationDate | 유통기한 임박 조회 |
| WarehouseStock | warehouse + quantity | 창고별 가용·부족 재고 조회 |
| Order | status | 출고대기 주문 조회 |
| Order | createdAt | 기간별 주문 조회 |
| AuditLog | createdAt | 최근 감사 이력 조회 |
| AuditLog | entityType + entityId | 대상 업무 데이터 이력 조회 |
| AuditLog | actorId | 처리자별 이력 조회 |
| Shipment | shippedAt | 기간별 출고 조회 |
| StockMovement | createdAt | 최근 이력 조회 |
| StockMovement | warehouse + createdAt | 출발·발생 창고별 이력 조회 |
| StockMovement | destinationWarehouse + createdAt | 도착 창고별 이동 조회 |
