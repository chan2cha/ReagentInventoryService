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
- 항원별 필터
- 제조번호 검색
- 유통기한 임박 필터
- 재고 부족 필터
- 신규 LOT 등록
- 재고 조정

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
- 주문 등록
- 주문 상세 조회
- 주문 취소
- 주문 상태 확인

### 1.7 출고 처리

기능:

- 출고대기 주문 조회
- 주문 상세 확인
- FEFO 기준 LOT 추천
- 출고 처리
- 출고 완료 후 출고이력 생성

### 1.8 재고 이동 이력

기능:

- 기간별 조회
- 항원별 조회
- 제조번호별 조회
- 거래처/주문 기준 조회
- 처리자 기준 조회

## 2. API 개요

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

## 3. API 응답 형식

모든 API는 다음 형식을 기본으로 사용한다.

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
- 주문 수량이 출고 가능 재고보다 많으면 출고하지 않는다.
