# 화면 및 API 개요서

## 1. 화면 목록

### 1.1 로그인 화면

- 아이디/비밀번호 입력
- 로그인 실패 메시지 표시
- 로그인 성공 시 대시보드 이동

### 1.2 대시보드

표시 정보:

- 오늘 주문 건수
- 출고대기 주문 건수
- 오늘 출고 건수
- 유통기한 30일 이내 LOT 수
- 재고 부족 LOT 수
- 최근 재고 이동 이력

### 1.3 항원 관리

기능:

- 항원 목록 조회
- 항원 등록
- 항원 수정
- 항원 비활성화
- 항원명 검색

### 1.4 LOT 재고 관리

기능:

- LOT 목록 조회
- 완제품·검체·반품·부적합·폐기 창고별 수량과 창고 컬럼 조회
- 시약명·코드·제조번호 검색
- 창고 및 정상·재고부족·품절·유통기한 임박·유통기한 만료 상태 필터
- 검색어와 상태의 페이지 이동 유지
- 신규 LOT 등록
- 하나의 `재고 관리` 다이얼로그에서 재고 조정과 창고 이동 전환
- `ADMIN`, `SHIPMENT_MANAGER`의 일부 수량 창고 이동과 사유 입력
- `DATA_EXPORT` 권한 사용자의 현재 검색어·상태 전체 결과 엑셀 바로 내보내기

### 1.5 거래처 관리

기능:

- 거래처 목록 조회
- 거래처 등록
- 거래처 수정
- 거래처 비활성화
- 거래처별 주문/출고 이력 조회

### 1.6 주문 관리

기능:

- 주문 목록 조회
- 단건 및 다건 주문 품목 등록
- 주문 품목 행 직접 추가·수정·삭제
- 거래처명·담당자·연락처 검색 선택
- 시약 코드·시약명 검색 선택
- 동일 주문 안의 중복 시약 선택 방지
- 주문당 선택 이미지 1개 첨부(JPG/PNG/WebP, 최대 3MB) 및 인증 사용자 이미지 보기
- 주문 상세 조회
- 주문 취소
- 주문 상태 확인
- 주문번호·거래처·시약·메모 및 한국 시간 기준 주문일 범위 조회
- `DATA_EXPORT` 권한 사용자의 현재 검색·기간 전체 주문 품목 Excel 내보내기

### 1.7 출고 처리

기능:

- 출고대기 주문 조회
- 주문 상세 확인
- 완제품 창고만 대상으로 하는 FEFO 기준 LOT 추천
- 출고 처리
- 출고 완료 후 출고이력 생성
- 사이드바에 접수·준비중 주문의 실제 출고 대기 건수 표시

### 1.8 재고 이동 이력

기능:

- 기간별 조회
- 항원별 조회
- 제조번호별 조회
- 입고, 출고, 조정, 폐기, 출고취소/복구, 창고이동 구분별 조회
- 발생·출발 창고와 창고이동 도착 창고 조회 및 창고 필터
- 거래처/주문 기준 조회
- 처리자 기준 조회
- `DATA_EXPORT` 권한 사용자의 현재 검색어·구분 전체 결과 엑셀 바로 내보내기

### 1.9 자료 내보내기

경로: `/exports`

접근 권한: `ADMIN`, `ORDER_MANAGER`, `SHIPMENT_MANAGER` (`DATA_EXPORT`). `VIEWER`는 제외한다.

기능:

- 재고 현황 또는 입출고 이력 개별 XLSX 다운로드
- 선택한 재고 현황과 입출고 이력을 한 파일의 개별 시트로 통합 다운로드
- 재고 시약명·코드·제조번호 검색, 창고 및 상태 필터
- 이력 시약명·코드·제조번호·사유 검색
- 한국 시간 기준 시작일·종료일 포함 기간 필터
- 입고, 출고, 조정, 폐기, 출고취소/복구, 창고이동 구분 및 창고 필터
- 생성자, 생성시각, 적용 필터와 건수를 담은 `내보내기정보` 시트
- 요청에 따라 `재고현황`, `입출고이력` 시트 생성
- 이력의 `기록 수량`과 실제 방향을 반영한 `재고 증감` 분리
- 시트당 10,000건, 최종 파일 4,000,000바이트 제한
- 통합 시트 및 이력 참조의 동일 `Repeatable Read` DB 스냅샷
- 보고서별 허용 파라미터와 Excel 셀·전체 문자 예산 검증
- `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, `ORDER_EXPORT`, `COMBINED_EXPORT` 성공 감사 로그
- 다운로드 준비 중 상태와 서버 오류 안내

## 2. API 개요

현재 업무 화면의 쓰기 동작은 Next.js Server Actions로 구현되어 있다. 아래 `/api/auth/*`, `/api/lots`, `/api/orders`, `/api/shipments` 표는 초기 REST 설계 개요이며 현재 배포본의 HTTP 라우트가 아니므로 직접 호출하면 404가 정상이다. 현재 실제 HTTP 다운로드 API는 `GET /api/exports`이고, 창고별 조정·이동은 `/lots`의 권한 보호 Server Action을 사용한다.

### 2.1 인증

| Method | Path | 설명 |
|---|---|---|
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/logout | 로그아웃 |

### 2.2 항원

| Method | Path | 설명 |
|---|---|---|
| GET | /api/allergens | 항원 목록 조회 |
| POST | /api/allergens | 항원 등록 |
| PATCH | /api/allergens/:id | 항원 수정 |
| PATCH | /api/allergens/:id/disable | 항원 비활성화 |

### 2.3 LOT 재고

| Method | Path | 설명 |
|---|---|---|
| GET | /api/lots | LOT 목록 조회 |
| POST | /api/lots | LOT 등록 |
| PATCH | /api/lots/:id | LOT 정보 수정 |
| POST | /api/lots/:id/adjust | 재고 조정 |
| POST | /api/lots/:id/transfer | 창고 간 부분 재고 이동(REST 전환 시의 설계 경로) |

### 2.4 거래처

| Method | Path | 설명 |
|---|---|---|
| GET | /api/clients | 거래처 목록 조회 |
| POST | /api/clients | 거래처 등록 |
| PATCH | /api/clients/:id | 거래처 수정 |
| PATCH | /api/clients/:id/disable | 거래처 비활성화 |

### 2.5 주문

| Method | Path | 설명 |
|---|---|---|
| GET | /api/orders | 주문 목록 조회 |
| POST | /api/orders | 주문 등록 |
| GET | /api/orders/:id | 주문 상세 조회 |
| PATCH | /api/orders/:id/cancel | 주문 취소 |

### 2.6 출고

| Method | Path | 설명 |
|---|---|---|
| POST | /api/orders/:id/ship | 주문 출고 처리 |
| PATCH | /api/shipments/:id/cancel | 출고 취소 |
| GET | /api/shipments | 출고 이력 조회 |

### 2.7 대시보드

| Method | Path | 설명 |
|---|---|---|
| GET | /api/dashboard | 대시보드 요약 정보 조회 |

### 2.8 자료 내보내기

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/exports` | 권한과 필터를 검증하고 XLSX 파일 생성 |

주요 쿼리 파라미터:

| 파라미터 | 적용 | 설명 |
|---|---|---|
| `report` | 전체 | `inventory`, `movements`, `orders`, `combined` 중 하나 |
| `datasets` | 통합 | `inventory`, `movements` 중 통합 파일에 포함할 자료 |
| `q` | 개별 | 해당 재고, 이력 또는 주문 검색어 |
| `inventoryQ` | 통합 | 재고 현황 검색어 |
| `status` | 재고 개별 | `NORMAL`, `LOW_STOCK`, `OUT_OF_STOCK`, `EXPIRING`, `EXPIRED` |
| `inventoryStatus` | 통합 | 재고 현황 상태 |
| `inventoryWarehouse` | 통합 | 재고 현황 창고 |
| `movementQ` | 통합 | 입출고 이력 검색어 |
| `movementWarehouse` | 통합 | 이력의 출발 또는 도착 창고 |
| `from`, `to` | 이력·주문 | 한국 시간 기준 포함 시작일·종료일 (`YYYY-MM-DD`) |
| `warehouse` | 개별 | 재고의 보관 창고 또는 이력의 출발·도착 창고 |
| `type` | 이력 | `IN`, `OUT`, `ADJUST`, `DISPOSE`, `REVERSE`, `TRANSFER` |

성공 응답은 XLSX 바이너리와 UTF-8 파일명을 포함한 첨부 응답이다. 인증되지 않은 요청은 401, 비밀번호 변경 필요 또는 권한 없는 요청은 403으로 거부한다. 필터 오류, 시트당 10,000건 초과, 최종 파일 4,000,000바이트 초과 및 생성 실패는 `{ "message": "...", "code": "..." }` JSON 오류로 반환한다. 성공 파일은 `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, `ORDER_EXPORT`, `COMBINED_EXPORT` 중 해당 감사 로그를 저장한 후에만 제공하며 DB 조회 실패 시 예시 데이터로 대체하지 않는다.

## 3. API 응답 형식

XLSX 다운로드의 바이너리 성공 응답과 별도 오류 형식을 제외한 일반 API는 다음 형식을 기본으로 사용한다.

```json
{
  "ok": true,
  "data": {}
}
```

오류 발생 시:

```json
{
  "ok": false,
  "message": "오류 메시지"
}
```

## 4. 입력 검증 원칙

- 필수값 누락 시 저장하지 않는다.
- 수량은 1 이상이어야 한다.
- 유통기한은 날짜 형식이어야 한다.
- 재고 조정 후 현재고가 음수가 되면 저장하지 않는다.
- 창고 이동 수량은 양의 정수여야 하고 출발·도착 창고는 달라야 하며 출발 창고 잔액을 초과할 수 없다.
- 주문 수량이 출고 가능 재고보다 많으면 출고하지 않는다.
- 한 주문의 품목은 시약별 1 이상의 정수 수량이어야 하며 서버는 중복 시약 행을 정규화한다.
- 내보내기 검색어는 200자 이하이며 이력 시작일은 종료일보다 늦을 수 없다.
- 내보내기는 요청한 시트별 10,000건과 최종 XLSX 4,000,000바이트 제한을 적용한다.
