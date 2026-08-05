# Reagent Inventory Service

알레르기 검사시약을 LOT(제조번호·유통기한) 단위로 관리하는 사내용 웹 서비스입니다. 입고, 재고, 거래처 주문, FEFO(유통기한이 빠른 재고 우선) 출고, 출고 취소, 선제 교환, 감사 로그와 Excel 내보내기를 한 곳에서 처리합니다.

> Prisma 모델명 <code>Allergen</code>은 기술적인 내부 이름입니다. 화면과 이 문서에서는 업무 담당자가 이해하기 쉬운 “시약”을 주로 사용합니다.

## 주요 기능

- 시약·거래처·사용자 기준정보 관리
- 제조번호·유통기한·창고별 LOT 입고 및 재고 현황 조회
- 완제품·검체·반품·부적합·폐기 기본 창고와 관리자 정의 창고, 부분 수량 창고 이동
- 창고별 품절, 유통기한 임박·만료 상태 표시
- 거래처·시약 검색 선택, 선택 이미지 첨부를 포함한 여러 품목 주문 등록·취소 및 상태 관리
- FEFO 기반 LOT 추천·출고 및 출고 취소 시 재고 복구
- 재고 추가·차감·폐기와 모든 입출고 이력 추적
- 유통기한 임박 출고품의 선제 교환 후보·정책·처리 이력 관리
- 검색·기간·필터 조건을 반영한 재고/입출고/주문내역 Excel 내보내기
- 서명된 httpOnly 세션, 역할별 권한, 비밀번호 변경·세션 무효화
- 관리자용 중요 작업 감사 로그
- 한국 표준시(KST) 기준 업무 날짜와 페이지 단위 목록 조회
- 로고 기반 바탕화면 아이콘과 독립 창을 제공하는 설치형 PWA

## 기술 구성

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js App Router, React, TypeScript |
| 데이터베이스 | PostgreSQL (Supabase 사용을 전제로 한 설정) |
| ORM | Prisma |
| UI | React Server Components, Server Actions, CSS |
| 인증 | PBKDF2 비밀번호 해시, HMAC 서명 httpOnly 쿠키 세션 |
| Excel | ExcelJS |
| 테스트 | Vitest 단위 테스트, PostgreSQL 통합 테스트 |

## 권한

| 역할 | 주요 권한 |
|---|---|
| <code>ADMIN</code> | 모든 조회·업무 처리, 기준정보·사용자·감사 로그·교환 정책 관리 |
| <code>ORDER_MANAGER</code> | 주문 등록·취소, 자료 내보내기 |
| <code>SHIPMENT_MANAGER</code> | 입고, 출고·취소, 창고별 재고 조정·이동, 선제 교환, 자료 내보내기 |
| <code>VIEWER</code> | 운영 데이터 조회만 가능 |

서버 액션과 API는 화면에 버튼이 보이는지와 별개로 인증·강제 비밀번호 변경·업무 권한을 다시 검사합니다.

## 시작하기

### 준비 사항

- Node.js 20.9 이상과 npm (현재 lockfile의 Next.js 16 요구사항)
- 접근 가능한 PostgreSQL 데이터베이스
- 런타임, 마이그레이션, 통합 테스트 목적에 맞게 분리한 DB 연결 정보

### 로컬 실행

1. 의존성을 설치합니다.

~~~powershell
npm ci
~~~

2. 환경 변수 예시를 복사한 뒤 실제 값으로 수정합니다. Next.js와 Prisma CLI는 이 파일을 사용합니다. <code>.env</code>에는 비밀값이 들어가므로 커밋하지 않습니다.

~~~powershell
Copy-Item .env.example .env
~~~

3. Prisma 스키마를 확인하고 Client를 생성합니다.

~~~powershell
npm run prisma:validate
npm run prisma:generate
~~~

4. 새 데이터베이스에는 커밋된 마이그레이션을 순서대로 적용합니다.

~~~powershell
npm run prisma:migrate:deploy
~~~

기존 운영 DB에 기준 마이그레이션을 등록하거나 재고 제약 마이그레이션을 적용할 때는 먼저 <code>docs/11_database_migrations.md</code>의 사전 점검·백업 절차를 따라야 합니다. 운영 DB에 <code>prisma db push</code>를 사용하지 마세요.

5. 개발 서버를 실행하고 <code>http://localhost:3000</code>에 접속합니다.

~~~powershell
npm run dev
~~~

### 샘플 데이터

샘플 시드는 승인된 비운영 환경에서만 사용합니다. 현재 <code>prisma/seed.js</code>는 <code>.env</code>를 직접 읽지 않으므로, 실행할 PowerShell 프로세스에 <code>DIRECT_URL</code>, <code>ALLOW_SAMPLE_DATA=true</code>, 12자 이상의 고유한 <code>SEED_ADMIN_PASSWORD</code>와 확인된 <code>SEED_DATABASE_TARGET</code>을 명시해야 합니다.

~~~powershell
$env:DIRECT_URL = "postgresql://USER:PASSWORD@verified-host:5432/postgres?schema=public"
$env:ALLOW_SAMPLE_DATA = "true"
$env:SEED_ADMIN_PASSWORD = "replace-with-a-unique-temporary-password"
$env:SEED_DATABASE_TARGET = "verified-host:5432/postgres?schema=public"
npm run prisma:seed
~~~

URL과 대상 문자열은 예시를 그대로 쓰지 말고 같은 비운영 DB를 가리키는지 직접 확인합니다. 시드가 만든 관리자는 첫 로그인 때 임시 비밀번호를 변경해야 합니다. 과거 공개 시드 관리자 계정의 교체 명령도 같은 방식으로 필요한 값을 프로세스 환경에 넣어야 하며, 자세한 절차는 <code>docs/11_database_migrations.md</code>를 참고하세요.

## 환경 변수

| 변수 | 설명 |
|---|---|
| <code>DATABASE_URL</code> | 애플리케이션 런타임용 PostgreSQL URL. Supabase에서는 일반적으로 transaction pooler를 사용합니다. |
| <code>DIRECT_URL</code> | Prisma 마이그레이션·시드용 직접 또는 session pooler URL입니다. |
| <code>TEST_DATABASE_URL</code> | 통합 테스트 전용 격리 DB URL입니다. 운영 DB와 같아서는 안 됩니다. |
| <code>AUTH_SECRET</code> | 세션 서명 비밀키입니다. 운영 환경에서는 임의의 긴 값(최소 32자)을 사용합니다. |
| <code>SEED_ADMIN_PASSWORD</code> | 샘플 관리자 생성 또는 과거 관리자 교체에 쓸 임시 비밀번호입니다. |
| <code>SEED_DATABASE_TARGET</code> | 잘못된 DB 시드를 막기 위해 <code>DIRECT_URL</code>에서 확인한 대상을 한 번 더 지정합니다. |
| <code>ALLOW_SAMPLE_DATA</code> | 개발 환경에서 샘플 fallback·시드를 명시적으로 허용할 때만 <code>true</code>로 설정합니다. |
| <code>AUTH_URL</code> | 배포 환경의 서비스 URL로 예약된 값입니다. 현재 애플리케이션 코드가 직접 참조하지는 않습니다. |
| <code>APP_ENV</code> | 로컬·운영 환경 표식입니다. 운영 표식은 시드 실행을 제한하고 인증 비밀키·쿠키 보안 정책에 반영됩니다. |

실제 형식은 <code>.env.example</code>을 기준으로 작성합니다.

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| <code>npm run dev</code> | Next.js 개발 서버를 실행합니다. |
| <code>npm run build</code> | 운영용 애플리케이션을 빌드합니다. |
| <code>npm run start</code> | 빌드된 운영 서버를 실행합니다. |
| <code>npm run lint</code> | ESLint를 경고 허용 없이 실행합니다. |
| <code>npm run typecheck</code> | 파일을 생성하지 않고 TypeScript 타입을 검사합니다. |
| <code>npm test</code> | DB 통합 테스트를 제외한 Vitest 테스트를 실행합니다. |
| <code>npm run test:integration</code> | <code>TEST_DATABASE_URL</code>의 격리 DB를 사용하는 통합 테스트를 직렬 실행합니다. |
| <code>npm run prisma:validate</code> | Prisma 스키마를 검사합니다. |
| <code>npm run prisma:generate</code> | Prisma Client를 생성합니다. |
| <code>npm run prisma:migrate -- --name 이름</code> | 개발 전용 DB에서 새 마이그레이션을 만들고 적용합니다. drift 상태에 따라 초기화를 요구할 수 있습니다. |
| <code>npm run prisma:migrate:deploy</code> | 커밋된 마이그레이션을 배포 대상 DB에 적용합니다. |
| <code>npm run prisma:migrate:status</code> | DB 마이그레이션 상태를 확인합니다. |
| <code>npm run prisma:seed</code> | 안전장치를 확인한 뒤 샘플 데이터를 생성합니다. |
| <code>npm run prisma:rotate-legacy-admin</code> | 과거 공개 시드 관리자 자격 증명을 안전하게 교체합니다. |

일반적인 변경 검증 순서는 다음과 같습니다.

~~~powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm test
npm run build
~~~

### 통합 테스트 DB 준비

통합 테스트는 운영 데이터와 완전히 분리된 <code>TEST_DATABASE_URL</code>에서만 실행합니다. 테스트는 테이블을 자동 생성하지 않으므로, 비어 있는 테스트 DB에는 먼저 현재 마이그레이션을 적용해야 합니다.

운영 URL이 섞이지 않은 별도의 PowerShell 창에서 검증한 테스트 DB URL을 두 Prisma URL에 임시로 지정해 마이그레이션합니다.

~~~powershell
$env:DATABASE_URL = "postgresql://TEST_USER:PASSWORD@verified-test-host:5432/postgres?schema=public"
$env:DIRECT_URL = "postgresql://TEST_USER:PASSWORD@verified-test-host:5432/postgres?schema=public"
npm run prisma:migrate:deploy
~~~

이 마이그레이션용 창을 닫은 뒤, 정상 <code>.env</code>에 서로 다른 운영 <code>DATABASE_URL</code>/<code>DIRECT_URL</code>과 격리된 <code>TEST_DATABASE_URL</code>이 설정된 일반 프로젝트 창에서 테스트를 실행합니다. 통합 테스트의 보호 로직은 테스트 URL이 운영 URL과 같은 데이터 대상을 가리키면 실행을 거부합니다.

~~~powershell
npm run test:integration
~~~

## 폴더 구조

~~~text
.
├─ docs/          기획, 요구사항, 설계, 운영 및 구현 현황 문서
├─ prisma/        데이터베이스 스키마, 마이그레이션, 시드
└─ src/
   ├─ app/        Next.js 라우트, 서버 액션, 데이터 조회, 화면 컴포넌트
   ├─ domain/     DB와 UI에 독립적인 업무 규칙과 입력 정규화
   ├─ integration/ 실제 PostgreSQL을 사용하는 통합 테스트
   ├─ lib/        인증, DB, 날짜, Excel 등 공용 인프라
   ├─ services/   트랜잭션 중심 업무 서비스
   └─ test/       테스트 공통 설정
~~~

아래 파일 안내는 Git으로 관리되는 프로젝트 파일을 기준으로 합니다. 설치·빌드 후 생기는 폴더와 로컬 전용 파일은 마지막의 “로컬·자동 생성 항목”에서 따로 설명합니다.

## 루트 파일

| 파일 | 역할 |
|---|---|
| <code>README.md</code> | 프로젝트 개요, 실행 방법, 환경 변수와 전체 파일 역할을 설명하는 시작 문서입니다. |
| <code>.editorconfig</code> | UTF-8, CRLF, 마지막 줄과 공백 처리 등 편집기 공통 규칙입니다. |
| <code>.env.example</code> | 비밀값 없이 환경 변수 이름과 URL 형식을 제공하는 템플릿입니다. |
| <code>.gitignore</code> | 의존성, 빌드 결과, 환경 변수, 로그, 캐시와 로컬 DB를 Git에서 제외합니다. |
| <code>eslint.config.mjs</code> | Next.js Core Web Vitals 기반 ESLint 규칙을 설정합니다. |
| <code>next-env.d.ts</code> | Next.js가 생성·관리하는 TypeScript 타입 선언 파일이며 직접 수정하지 않습니다. |
| <code>next.config.ts</code> | 타입 안전 라우트(<code>typedRoutes</code>)를 켜는 Next.js 설정입니다. |
| <code>package.json</code> | npm 의존성과 개발·빌드·테스트·Prisma 명령을 정의합니다. |
| <code>package-lock.json</code> | 재현 가능한 설치를 위해 npm 의존성의 정확한 버전을 고정합니다. |
| <code>tsconfig.json</code> | 엄격한 TypeScript 검사, Next.js 타입과 <code>@/* → src/*</code> 별칭을 설정합니다. |
| <code>vitest.config.ts</code> | Node 환경의 단위 테스트, 공통 setup, 경로 별칭과 통합 테스트 제외 규칙을 설정합니다. |
| <code>vitest.integration.config.ts</code> | 환경 변수를 로드하고 DB 통합 테스트만 직렬로 실행합니다. |

## <code>docs/</code>

| 파일 | 역할 |
|---|---|
| <code>docs/00_project_overview.md</code> | 프로젝트 배경, 목표, 사용자, 기술 방향과 핵심 설계 원칙을 설명합니다. |
| <code>docs/01_requirements.md</code> | 로그인·권한, 시약·LOT·거래처·주문·출고·이력·Excel과 비기능 요구사항을 정의합니다. |
| <code>docs/02_business_workflow.md</code> | 주문, FEFO 출고, 입고, 재고 조정, 취소와 내보내기의 상태·예외 흐름을 설명합니다. |
| <code>docs/03_data_model.md</code> | 주요 엔티티, 상태값, 관계, 제약조건과 인덱스를 정리한 논리 데이터 모델입니다. |
| <code>docs/04_mvp_roadmap.md</code> | 단계별 MVP 범위, 포함·제외 기능, 완료 기준과 우선 개발 화면을 정리합니다. |
| <code>docs/05_deployment_operations.md</code> | 운영 환경, 배포 흐름, 환경 변수, 배포 전 검증, 백업과 장애 대응 방식을 설명합니다. |
| <code>docs/06_security_backup_policy.md</code> | 계정·권한·데이터 보호, 감사, 백업·복구와 운영 위험 정책을 정의합니다. |
| <code>docs/07_screen_api_outline.md</code> | 화면별 기능, API 개요, 응답 형식과 입력 검증 원칙을 정리합니다. |
| <code>docs/08_erd.md</code> | 현재 Prisma 모델의 ERD, 사용자 용어, 테이블·열거형·핵심 규칙과 인덱스를 설명합니다. |
| <code>docs/09_current_implementation_status.md</code> | 작성 시점의 구현 화면·워크플로, 환경, DB·시드, 검증 결과와 알려진 문제를 기록합니다. |
| <code>docs/10_remaining_work.md</code> | 남은 작업의 우선순위, 완료된 개선과 다음 구현 순서를 추적합니다. |
| <code>docs/11_database_migrations.md</code> | Prisma 기준선, 사전 점검, 배포·복구, 개별 마이그레이션과 신규 환경 생성 절차를 설명합니다. |
| <code>docs/12_synology_empty_database_test_updated.md</code> | Synology Container Manager에 빈 PostgreSQL을 만들고 Windows에서 Prisma 마이그레이션을 검증하는 절차입니다. |

현황 문서(<code>09</code>, <code>10</code>)는 특정 시점의 기록이므로 기능 변경 시 함께 갱신해야 합니다.

## <code>prisma/</code>

| 파일 | 역할 |
|---|---|
| <code>prisma/schema.prisma</code> | PostgreSQL 연결, 열거형과 사용자·감사·시약·LOT·거래처·주문·출고·교환·이동 모델을 정의하는 기준 스키마입니다. |
| <code>prisma/seed.js</code> | 안전장치 아래 샘플 기준정보·업무 데이터·관리자를 만들고 과거 관리자 교체 모드도 제공합니다. |
| <code>prisma/migrations/migration_lock.toml</code> | 마이그레이션 데이터베이스 공급자를 PostgreSQL로 고정하는 Prisma 관리 파일입니다. |
| <code>prisma/migrations/20260710000000_baseline/migration.sql</code> | 핵심 열거형·테이블·인덱스·외래키를 만드는 초기 기준 스키마입니다. |
| <code>prisma/migrations/20260712000000_enforce_inventory_invariants/migration.sql</code> | 기존 데이터 사전 검증 후 재고 수량·날짜 제약과 유일성·조회 인덱스를 강화합니다. |
| <code>prisma/migrations/20260712150000_add_order_templates/migration.sql</code> | 재사용 가능한 주문 세트와 품목 테이블, 제약·관계·인덱스를 추가한 이력입니다. |
| <code>prisma/migrations/20260713100000_add_user_session_version/migration.sql</code> | 비밀번호 변경·계정 비활성화 때 기존 세션을 무효화할 <code>User.sessionVersion</code>을 추가합니다. |
| <code>prisma/migrations/20260713110000_add_proactive_replacements/migration.sql</code> | 선제 교환 열거형·테이블, 출고 목적과 관련 제약·인덱스·외래키를 추가합니다. |
| <code>prisma/migrations/20260713120000_add_replacement_policy/migration.sql</code> | 교환 탐지일과 최소 잔여 유효기간을 보관하는 정책 테이블과 기본값을 추가합니다. |
| <code>prisma/migrations/20260721150000_remove_order_templates/migration.sql</code> | 더 이상 사용하지 않는 주문 세트 품목과 본문 테이블을 제거합니다. |
| <code>prisma/migrations/20260721160000_add_transfer_movement_type/migration.sql</code> | PostgreSQL 커밋 경계를 지켜 <code>StockMovementType.TRANSFER</code>를 선행 추가합니다. |
| <code>prisma/migrations/20260721161000_add_warehouse_inventory/migration.sql</code> | 기존 현재고를 완제품 창고로 이관하고 <code>WarehouseStock</code> 단일 수량 원천과 이동 제약·인덱스를 적용합니다. |
| <code>prisma/migrations/20260721170000_add_order_image/migration.sql</code> | 주문당 하나의 검증된 이미지 원본을 DB에 저장하는 테이블과 제약을 추가합니다. |
| <code>prisma/migrations/20260721180000_update_client_delivery_fields/migration.sql</code> | 거래처 연락처·주소 필드를 지역·납품 부서 중심 정보로 전환합니다. |
| <code>prisma/migrations/20260722100000_add_partial_shipment_reorders/migration.sql</code> | 부분 출고 상태와 부족분 자동 재주문 연결을 추가합니다. |
| <code>prisma/migrations/20260722113000_add_warehouse_master/migration.sql</code> | 창고 enum을 코드 문자열로 전환하고 관리자용 창고 기준정보를 추가합니다. |
| <code>prisma/migrations/20260722120000_add_warehouse_active/migration.sql</code> | 창고 기준정보에 활성 상태를 추가합니다. |
| <code>prisma/migrations/20260723133000_add_manual_defect_replacements/migration.sql</code> | 제품 하자 수동 교환의 구분과 사유 제약을 추가합니다. |
| <code>prisma/migrations/20260723160000_remove_allergen_min_stock/migration.sql</code> | 더 이상 사용하지 않는 시약별 안전재고 필드와 제약을 제거합니다. |
| <code>prisma/migrations/20260729140000_add_shipment_item_warehouse/migration.sql</code> | 출고 품목에 실제 출고 창고를 저장하고 기존 출고 이력은 완제품 창고로 보존합니다. |

## <code>src/app/</code> 공통 파일

<code>src/app</code>은 Next.js App Router 루트입니다. 전역 레이아웃·대시보드와 여러 화면에서 공유하는 UI·데이터 모듈이 여기에 있습니다.

| 파일 | 역할 |
|---|---|
| <code>src/app/actions-framework-error.test.ts</code> | 인증 리다이렉트 같은 Next.js 제어 흐름 오류를 서버 액션들이 일반 오류로 바꾸지 않는지 검증합니다. |
| <code>src/app/dashboard-data.ts</code> | 대시보드 통계, 확인할 LOT, 주문·이동·선제 교환 현황을 조회하고 허용된 개발 환경에서 샘플 fallback을 제공합니다. |
| <code>src/app/manifest.ts</code> | 설치 이름·색상·시작 경로와 일반·마스커블 로고 아이콘을 정의하는 PWA 매니페스트입니다. |
| <code>src/app/pwa-registration.tsx</code> | 운영 빌드에서 서비스 워커를 브라우저에 등록합니다. |
| <code>src/app/dialog-frame.tsx</code> | 열기·닫기, 배경 클릭과 포커스 동작을 공통화한 모달 프레임입니다. |
| <code>src/app/error.test.tsx</code> | 앱 루트 세그먼트 오류 화면이 내부 정보를 노출하지 않고 재시도 안내를 제공하는지 검증합니다. |
| <code>src/app/error.tsx</code> | App Router의 앱 루트 세그먼트 아래에서 발생한 오류를 안내하고 재시도를 제공합니다. |
| <code>src/app/expiry-date-summary.tsx</code> | 유통기한과 남은 날 또는 만료 경과일을 위험도 색상과 함께 표시합니다. |
| <code>src/app/flash-message.tsx</code> | 성공·오류 플래시 메시지를 표시한 뒤 삭제 API를 호출해 일회성으로 소비합니다. |
| <code>src/app/globals.css</code> | 로그인, 앱 셸, 표, 폼, 다이얼로그와 반응형 화면의 전역 스타일입니다. |
| <code>src/app/item-quantity-summary.tsx</code> | 주문·출고 품목의 시약 코드별 수량을 간단한 목록으로 표시합니다. |
| <code>src/app/layout.tsx</code> | 한국어 문서 구조, 전역 메타데이터와 CSS를 적용하는 루트 레이아웃입니다. |
| <code>src/app/operation-guide.tsx</code> | 정보·성공·주의 톤과 아이콘으로 업무 전 확인 사항을 표시합니다. |
| <code>src/app/page.tsx</code> | <code>/</code> 대시보드에서 재고·주문·이동·교환 현황을 보여줍니다. |
| <code>src/app/pagination.tsx</code> | 검색 조건을 유지하며 20건 단위 이전·다음 이동과 현재 범위를 표시합니다. |
| <code>src/app/progress-link.module.css</code> | 페이지 이동 진행 막대와 접근성 상태 문구의 스타일입니다. |
| <code>src/app/progress-link.test.tsx</code> | 링크 대기 상태에 맞는 진행 표시와 스크린 리더 문구를 검증합니다. |
| <code>src/app/progress-link.tsx</code> | Next.js 링크 이동 중 전역 진행 표시와 접근성 피드백을 제공하는 래퍼입니다. |
| <code>src/app/reagent-data.ts</code> | 개발용 샘플 시약·LOT·거래처·주문·이동 데이터와 날짜·상태 계산 도우미입니다. |
| <code>src/app/reagent-ui.tsx</code> | 역할별 메뉴·배지를 포함한 앱 셸과 패널·표·통계·상태 배지 공용 UI입니다. |
| <code>src/app/registration-dialog.tsx</code> | 등록·수정 폼에 맞게 공용 모달 프레임을 감싼 관리 화면용 다이얼로그입니다. |
| <code>src/app/sidebar-data.test.ts</code> | 출고 대기·교환 후보 집계, 큰 배지 숫자와 조회 실패 시 숨김 처리를 검증합니다. |
| <code>src/app/sidebar-data.ts</code> | 사이드바의 출고 대기·선제 교환 후보 수를 조회하고 실패를 화면 전체 오류와 분리합니다. |
| <code>src/app/submit-button.test.tsx</code> | 제출 버튼의 기본·대기·비활성·접근성 상태를 검증합니다. |
| <code>src/app/submit-button.tsx</code> | 제출 중 중복 요청 방지, 로딩 표시와 확인 대화상자를 지원하는 버튼입니다. |
| <code>src/app/table-search-submit.tsx</code> | 검색 제출 중 로딩과 페이지 이동 피드백을 표시합니다. |
| <code>src/app/table-search.tsx</code> | 검색어·선택 필터·보존 쿼리·초기화를 조합하는 표 검색 폼입니다. |

## 화면·API 폴더

| 폴더 | 역할 |
|---|---|
| <code>src/app/access-denied/</code> | 권한이 없는 사용자를 위한 안내 라우트입니다. |
| <code>src/app/account/</code> | 현재 사용자 계정 관련 라우트를 묶습니다. |
| <code>src/app/account/password/</code> | 비밀번호 변경과 세션 갱신 흐름입니다. |
| <code>src/app/allergens/</code> | 시약 기준정보 조회·등록·수정·활성 상태 관리입니다. |
| <code>src/app/api/</code> | 화면이 아닌 HTTP API Route Handler를 묶습니다. |
| <code>src/app/api/exports/</code> | 권한이 보호된 Excel 생성·다운로드 API입니다. |
| <code>src/app/api/flash/</code> | 일회성 플래시 메시지 삭제 API입니다. |
| <code>src/app/audit/</code> | 관리자용 감사 로그 조회입니다. |
| <code>src/app/clients/</code> | 거래처 기준정보 관리입니다. |
| <code>src/app/exports/</code> | 내보내기 조건 입력과 다운로드 UI입니다. |
| <code>src/app/login/</code> | 로그인 화면·검증·세션 생성입니다. |
| <code>src/app/logout/</code> | 세션 삭제와 로그아웃 처리입니다. |
| <code>src/app/lots/</code> | LOT별 재고 조회·필터·조정입니다. |
| <code>src/app/movements/</code> | 입고·출고·조정·폐기·복구 이력 조회입니다. |
| <code>src/app/orders/</code> | 주문 목록·취소와 주문 하위 업무를 묶습니다. |
| <code>src/app/orders/new/</code> | 여러 시약과 수량을 직접 입력하는 신규 주문 작성입니다. |
| <code>src/app/receiving/</code> | 신규 LOT 입고 등록입니다. |
| <code>src/app/replacements/</code> | 유통기한 임박 출고품의 선제 교환 관리입니다. |
| <code>src/app/shipments/</code> | 출고 대기, LOT 배정, 출고와 출고 취소입니다. |
| <code>src/app/users/</code> | 관리자용 사용자·역할·계정 상태 관리입니다. |

### 접근 거부와 계정

| 파일 | 역할 |
|---|---|
| <code>src/app/access-denied/page.tsx</code> | <code>/access-denied</code>에서 필요한 권한이 없음을 안내합니다. |
| <code>src/app/account/password/actions.test.ts</code> | 비밀번호 변경 시 세션 버전 증가와 현재 세션 재발급을 검증합니다. |
| <code>src/app/account/password/actions.ts</code> | 현재·새 비밀번호를 검증하고 해시·세션 버전을 갱신해 새 세션을 발급합니다. |
| <code>src/app/account/password/page.tsx</code> | <code>/account/password</code> 비밀번호 변경 폼과 최초 로그인 규칙을 표시합니다. |

### 시약 관리

| 파일 | 역할 |
|---|---|
| <code>src/app/allergens/actions.ts</code> | 관리자 권한으로 시약 코드·이름·분류를 등록·수정하고 활성 상태를 바꿉니다. |
| <code>src/app/allergens/allergen-data.ts</code> | 시약을 검색·페이지 조회하고 LOT 수를 집계하며 개발용 샘플 fallback을 처리합니다. |
| <code>src/app/allergens/page.tsx</code> | <code>/allergens</code> 시약 목록과 관리자용 등록·수정·활성화 UI입니다. |

### API

| 파일 | 역할 |
|---|---|
| <code>src/app/api/exports/route.test.ts</code> | 내보내기 인증·권한·필터·시트·행/파일/문자 제한과 감사 실패 처리를 검증합니다. |
| <code>src/app/api/exports/route.ts</code> | <code>GET /api/exports</code> 요청으로 재고·이동·주문·통합 XLSX를 만들고 감사 로그를 기록합니다. |
| <code>src/app/api/flash/route.ts</code> | <code>DELETE /api/flash</code> 요청으로 일회성 플래시 쿠키를 지웁니다. |

### 감사 로그

| 파일 | 역할 |
|---|---|
| <code>src/app/audit/audit-data.ts</code> | 작업·설명·처리자 검색을 지원하는 감사 로그를 페이지 단위로 조회합니다. |
| <code>src/app/audit/page.tsx</code> | <code>/audit</code> 관리자 전용 감사 로그 검색·목록 화면입니다. |

### 거래처 관리

| 파일 | 역할 |
|---|---|
| <code>src/app/clients/actions.ts</code> | 관리자 권한으로 거래처 중복을 검사하고 등록·수정·활성 상태 변경을 수행합니다. |
| <code>src/app/clients/client-data.ts</code> | 거래처를 검색·페이지 조회하고 주문 수·지역을 가공하며 개발용 샘플 fallback을 처리합니다. |
| <code>src/app/clients/page.tsx</code> | <code>/clients</code> 거래처 목록과 관리자용 등록·수정·활성화 UI입니다. |

### 자료 내보내기

| 파일 | 역할 |
|---|---|
| <code>src/app/exports/export-center.tsx</code> | 재고·이동 검색, 상태·기간 필터와 개별·통합 Excel 다운로드 조건을 구성합니다. |
| <code>src/app/exports/export-download-button.test.ts</code> | 빈 필터 제거와 응답의 UTF-8·일반 파일명 해석·안전화를 검증합니다. |
| <code>src/app/exports/export-download-button.tsx</code> | 내보내기 API 응답·파일명을 검증해 다운로드하고 로딩·오류를 표시합니다. |
| <code>src/app/exports/page.tsx</code> | <code>/exports</code> 권한 사용자를 위한 자료 내보내기 화면입니다. |

### 로그인과 로그아웃

| 파일 | 역할 |
|---|---|
| <code>src/app/login/actions.test.ts</code> | 미등록·비활성 계정의 동일 실패 경로와 성공 세션 버전 저장을 검증합니다. |
| <code>src/app/login/actions.ts</code> | 아이디·비밀번호를 검증해 세션을 만들고 비밀번호 변경 또는 대시보드로 이동합니다. |
| <code>src/app/login/page.tsx</code> | <code>/login</code> 회사 브랜딩과 로그인 폼을 표시합니다. |
| <code>src/app/logout/actions.ts</code> | 현재 세션을 삭제하고 로그인 화면으로 이동합니다. |

### LOT 재고

| 파일 | 역할 |
|---|---|
| <code>src/app/lots/actions.ts</code> | 창고별 LOT 재고 추가·차감·폐기와 부분 창고 이동을 검증하고 이력과 함께 처리합니다. |
| <code>src/app/lots/lot-data.test.ts</code> | 수량·유통기한 상태 필터의 DB 조회와 페이지 계산을 검증합니다. |
| <code>src/app/lots/lot-data.ts</code> | <code>WarehouseStock</code> 기준 LOT·창고 검색, 상태 필터, 페이지 조회와 수량·유통기한 상태 계산을 수행합니다. |
| <code>src/app/lots/lot-table-filters.tsx</code> | LOT 검색어와 창고 및 정상·품절·임박·만료 필터를 구성합니다. |
| <code>src/app/lots/page.tsx</code> | <code>/lots</code> 창고별 LOT 현황, 단일 재고 관리 버튼과 현재 조건 내보내기를 제공합니다. |
| <code>src/app/lots/inventory-management-dialog.tsx</code> | 한 다이얼로그에서 추가·차감·폐기 재고 조정과 부분 창고 이동을 전환하고 처리 전 수량을 확인합니다. |
| <code>src/app/lots/inventory-management-dialog.test.tsx</code> | 단일 버튼·단일 다이얼로그와 0재고일 때의 이동 제한을 검증합니다. |

### 입출고 이력

| 파일 | 역할 |
|---|---|
| <code>src/app/movements/movement-data.test.ts</code> | 검색어와 이동 유형이 건수·목록 쿼리에 똑같이 적용되는지 검증합니다. |
| <code>src/app/movements/movement-data.ts</code> | 재고 이동을 검색·유형·창고 필터·페이지 조회하고 출발·도착 창고 표시값으로 변환합니다. |
| <code>src/app/movements/movement-table-filters.tsx</code> | 이동 검색어와 입고·출고·조정·폐기·복구·창고이동 유형 및 창고 필터를 구성합니다. |
| <code>src/app/movements/page.tsx</code> | <code>/movements</code> 재고 이동 이력과 조건별 내보내기를 제공합니다. |

### 주문

| 파일 | 역할 |
|---|---|
| <code>src/app/orders/actions.ts</code> | 권한·취소 사유를 검증해 출고 전 주문을 취소합니다. |
| <code>src/app/orders/order-data.ts</code> | 주문 번호·거래처·시약·메모와 KST 주문일 범위로 주문을 검색하고 품목·상태를 페이지 조회합니다. |
| <code>src/app/orders/page.tsx</code> | <code>/orders</code> 주문 목록, 기간 검색, 주문내역 Excel, 신규 주문과 취소 UI입니다. |

### 신규 주문

| 파일 | 역할 |
|---|---|
| <code>src/app/orders/new/actions.test.ts</code> | 직접 입력한 여러 품목의 서비스 전달과 성공 리다이렉트를 검증합니다. |
| <code>src/app/orders/new/actions.ts</code> | 여러 주문 품목을 정규화·검증해 주문 생성 서비스로 전달합니다. |
| <code>src/app/orders/new/order-form-data.test.ts</code> | 활성 거래처·시약 변환과 조회 실패 시 표준 fallback을 검증합니다. |
| <code>src/app/orders/new/order-form-data.ts</code> | 활성 거래처·시약을 조회해 신규 주문 폼 데이터로 변환합니다. |
| <code>src/app/orders/new/order-form.tsx</code> | 여러 시약과 수량을 직접 추가·수정·삭제하는 주문 입력을 지원합니다. |
| <code>src/app/orders/new/page.tsx</code> | <code>/orders/new</code> 권한 검사 후 신규 주문 폼을 표시합니다. |

### 입고

| 파일 | 역할 |
|---|---|
| <code>src/app/receiving/actions.ts</code> | 입고 값·창고와 중복 LOT를 검증해 LOT, 창고 잔액과 입고 이동을 한 트랜잭션으로 저장합니다. |
| <code>src/app/receiving/receiving-data.ts</code> | 입고 폼의 활성 시약 목록을 조회하고 개발용 샘플 fallback을 처리합니다. |
| <code>src/app/receiving/page.tsx</code> | <code>/receiving</code> 시약·LOT·수량·창고·입고일·유통기한 등록 화면입니다. |

### 사후 관리

| 파일 | 역할 |
|---|---|
| <code>src/app/replacements/actions.ts</code> | 교환 확정·제외·출고·기존품 처리 결과와 관리자 교환 정책 변경을 처리합니다. |
| <code>src/app/replacements/replacement-data.ts</code> | 정책 기준 교환 후보와 확정·완료·제외 이력 및 교환 LOT를 조회합니다. |
| <code>src/app/replacements/page.tsx</code> | <code>/replacements</code> 후보 처리, 교환 출고, 이력과 정책 설정 화면입니다. |

### 출고

| 파일 | 역할 |
|---|---|
| <code>src/app/shipments/actions.ts</code> | 주문별 LOT 배정 수량을 검증해 출고를 확정하거나 취소·재고 복구를 수행합니다. |
| <code>src/app/shipments/page.tsx</code> | <code>/shipments</code> 출고 대기·추천 LOT·출고 이력과 출고·취소 UI입니다. |
| <code>src/app/shipments/shipment-allocation-dialog.tsx</code> | FEFO 추천값과 품목별 실제 출고 수량을 확인하는 다이얼로그입니다. |
| <code>src/app/shipments/shipment-data.ts</code> | 출고 대기 주문, 활성 창고별 FEFO 추천·사용 가능 LOT와 출고 이력을 조회합니다. |

### 사용자 관리

| 파일 | 역할 |
|---|---|
| <code>src/app/users/actions.test.ts</code> | 계정 비활성화·비밀번호 초기화 시 세션 버전 증가를 검증합니다. |
| <code>src/app/users/actions.ts</code> | 사용자 생성, 활성 상태·임시 비밀번호·세션 버전 변경과 감사를 처리합니다. |
| <code>src/app/users/page.tsx</code> | <code>/users</code> 관리자 전용 사용자 검색·등록·상태·비밀번호 관리 화면입니다. |
| <code>src/app/users/user-data.ts</code> | 사용자를 검색·페이지 조회하고 역할·상태·가입일 표시값을 만듭니다. |

## <code>src/domain/</code>

UI와 데이터 영속화 실행에서 분리한 입력 정규화와 핵심 업무 규칙입니다. 일부 모듈은 타입 안전한 조회 조건을 만들기 위해 Prisma 타입을 사용합니다.

| 파일 | 역할 |
|---|---|
| <code>src/domain/export-filters.test.ts</code> | 검색 결합, LOT 상태 경계, KST 날짜 범위와 잘못된 필터 거부를 검증합니다. |
| <code>src/domain/export-filters.ts</code> | 재고·이동 검색어, 상태·유형·한국 날짜를 검증해 Prisma 조건으로 변환합니다. |
| <code>src/domain/lot-status.ts</code> | 유통기한과 현재 수량으로 LOT 상태와 표시명을 우선순위대로 판정합니다. |
| <code>src/domain/order-items.test.ts</code> | 중복 품목 병합과 빈 시약·잘못된 수량 거부를 검증합니다. |
| <code>src/domain/order-items.ts</code> | 주문 품목의 시약 ID·양의 정수 수량을 검증하고 같은 품목을 합칩니다. |
| <code>src/domain/pending-shipment.ts</code> | 출고 대기 주문 상태와 공통 Prisma 조회 조건을 정의합니다. |
| <code>src/domain/stock-adjustment.test.ts</code> | 조정 연산별 부호, 잘못된 숫자와 음수 재고 거부를 검증합니다. |
| <code>src/domain/stock-adjustment.ts</code> | 추가·차감·폐기를 부호 있는 증감량으로 바꾸고 음수 재고를 막습니다. |
| <code>src/domain/stock-movement-presentation.test.ts</code> | 모든 이동 유형의 표시명·증감 방향·타입 판별을 검증합니다. |
| <code>src/domain/stock-movement-presentation.ts</code> | 이동 유형의 화면 표시명과 실제 재고 증감 방향을 제공합니다. |
| <code>src/domain/stock.test.ts</code> | 유통기한이 빠른 LOT부터 수량을 배정하는 FEFO 예제를 단위 검증합니다. |
| <code>src/domain/warehouse.test.ts</code> | 기본 창고 표시명과 동적 창고 코드 판별을 검증합니다. |
| <code>src/domain/warehouse.ts</code> | 기본 창고 표시명과 동적 창고 코드 입력 판별 함수를 제공합니다. |

## <code>src/lib/</code>

인증, DB 연결, 날짜, 메시지와 파일 생성 같은 공용 인프라입니다.

| 파일 | 역할 |
|---|---|
| <code>src/lib/access.test.ts</code> | 관리자·주문·출고·조회 역할의 허용·차단 범위를 검증합니다. |
| <code>src/lib/access.ts</code> | 사용자 역할별 업무 권한 매핑과 권한 확인 함수를 정의합니다. |
| <code>src/lib/auth.test.ts</code> | 강제 비밀번호 변경 접근 제한과 운영 환경의 취약한 비밀키 거부를 검증합니다. |
| <code>src/lib/auth.ts</code> | 세션 쿠키 생성·삭제, 현재 사용자 조회와 로그인·역할 접근 제어를 담당합니다. |
| <code>src/lib/data-source.test.ts</code> | 샘플 fallback의 개발 opt-in 및 운영 환경 금지 정책을 검증합니다. |
| <code>src/lib/data-source.ts</code> | DB 오류 시 허용된 개발 환경만 샘플 데이터를 사용하고 그 외에는 오류를 전파합니다. |
| <code>src/lib/date.test.ts</code> | 한국 자정, UTC 범위, KST 표시와 날짜 단위 유통기한 비교를 검증합니다. |
| <code>src/lib/date.ts</code> | 한국 날짜 키·날짜 접두사·일시, 하루 범위, 날짜 덧셈과 남은 일수를 계산합니다. |
| <code>src/lib/excel-export.test.ts</code> | 시트 순서·셀 타입·서식·메타정보·증감량과 빈 시트 생성을 검증합니다. |
| <code>src/lib/excel-export.ts</code> | 메타·재고·이동 데이터를 서식, 필터와 고정 헤더가 있는 XLSX 버퍼로 만듭니다. |
| <code>src/lib/flash-message.test.ts</code> | 플래시 쿠키 옵션, 정상·손상 값, 삭제와 리다이렉트를 검증합니다. |
| <code>src/lib/flash-message.ts</code> | 성공·오류 메시지를 짧은 httpOnly 쿠키로 저장·조회·삭제하고 리다이렉트합니다. |
| <code>src/lib/form-data.ts</code> | FormData의 단일·복수 문자열을 안전하게 읽고 양끝 공백을 제거합니다. |
| <code>src/lib/pagination.test.ts</code> | 잘못된 페이지 기본값, 마지막 페이지 보정과 20건 분할을 검증합니다. |
| <code>src/lib/pagination.ts</code> | 20건 기준 페이지 번호, 메타데이터와 배열 페이지 분할을 제공합니다. |
| <code>src/lib/password.test.ts</code> | 정상·오류 비밀번호, 손상 해시와 미등록 계정의 더미 검증 경로를 확인합니다. |
| <code>src/lib/password.ts</code> | PBKDF2-SHA256 비밀번호 해시·검증과 일정 비용의 더미 로그인 검증을 제공합니다. |
| <code>src/lib/prisma.test.ts</code> | transaction pooler URL의 기본 제한 옵션 추가와 기존 값 보존을 검증합니다. |
| <code>src/lib/prisma.ts</code> | 런타임 DB URL을 보정하고 개발 중 재사용하는 Prisma 싱글턴을 생성합니다. |
| <code>src/lib/session-token.test.ts</code> | 세션 토큰 왕복과 만료·변조·누락/잘못된 버전 거부를 검증합니다. |
| <code>src/lib/session-token.ts</code> | HMAC-SHA256 세션 토큰을 인코딩하고 서명·만료·버전을 검증해 디코딩합니다. |
| <code>src/lib/transaction.test.ts</code> | DB·명시적 충돌 재시도, 일반 오류와 재시도 소진 처리를 검증합니다. |
| <code>src/lib/transaction.ts</code> | Serializable Prisma 트랜잭션과 직렬화·CAS 충돌 제한 재시도를 제공합니다. |

## <code>src/services/</code>

조회 전용 데이터 서비스와 여러 모델의 변경에서 원자성·동시성·감사 기록을 보장하는 업무 서비스를 모아 둡니다.

| 파일 | 역할 |
|---|---|
| <code>src/services/export-data-service.test.ts</code> | LOT 상태·필터, 출고 참조·증감량, 행 제한과 DB 오류 전파를 검증합니다. |
| <code>src/services/export-data-service.ts</code> | 필터된 재고·이동 데이터를 안정된 순서로 조회하고 10,000행 제한과 출고 참조를 처리합니다. |
| <code>src/services/order-create-service.test.ts</code> | 정상 생성, 비활성 기준정보, 주문번호 충돌 재시도와 일일 한계를 검증합니다. |
| <code>src/services/order-create-service.ts</code> | 활성 기준정보를 확인하고 날짜별 주문번호를 발급해 주문과 감사를 원자 생성합니다. |
| <code>src/services/order-service.ts</code> | 미출고 주문만 동시성에 안전하게 취소하고 감사 로그를 남깁니다. |
| <code>src/services/replacement-service.ts</code> | 교환 확정·제외와 정책 기반 FEFO 교환 출고 완료·감사를 처리합니다. |
| <code>src/services/shipment-service.ts</code> | FEFO/지정 LOT 출고와 재고·이동·감사 생성, 출고 취소·재고 복구를 처리합니다. |
| <code>src/services/stock-service.ts</code> | 창고 잔액의 조건부 증감과 이동 기록을 원자 처리해 음수 재고·동시성 충돌을 막습니다. |
| <code>src/services/warehouse-transfer-service.test.ts</code> | 부분 이동, 입력·잔액 오류, 비교·갱신 충돌 재시도와 이력 중복 방지를 검증합니다. |
| <code>src/services/warehouse-transfer-service.ts</code> | 출발 잔액 차감, 도착 잔액 증가, <code>TRANSFER</code>와 <code>STOCK_TRANSFER</code> 감사를 Serializable 트랜잭션으로 처리합니다. |

## 테스트 기반

| 파일 | 역할 |
|---|---|
| <code>src/integration/database.integration.test.ts</code> | 격리 DB에서 다중 창고 FEFO 출고·취소, 창고 부분 이동·재고 경쟁, 주문번호, 내보내기와 선제 교환의 실제 트랜잭션을 검증합니다. |
| <code>src/test/setup.ts</code> | 플래시 메시지 모듈을 공통 mock해 쿠키 부작용 없이 서버 동작을 테스트하도록 설정합니다. |

<code>*.test.ts</code>와 <code>*.test.tsx</code>는 외부 서비스 없이 실행하는 단위·정책·컴포넌트 테스트입니다. <code>*.integration.test.ts</code>는 실제 PostgreSQL 트랜잭션을 사용하므로 전용 테스트 DB가 필요합니다.

## PWA 설치

운영 빌드를 HTTPS로 제공하거나 로컬의 `localhost`에서 열면 Chrome 또는 Edge의 주소창 설치 버튼으로 앱을 설치할 수 있습니다. 설치 후 바탕화면과 시작 메뉴에는 `public/logo.png`를 흰색 정사각형에 배치한 아이콘이 사용되며 앱은 독립 창으로 실행됩니다.

서비스 워커는 인증 화면, 업무 페이지, API 응답을 캐시하지 않습니다. 로고와 Next.js 정적 자산만 캐시하고, 네트워크 연결 실패 시 읽기 전용 안내 화면을 표시하므로 업무 데이터의 오프라인 입력·저장은 지원하지 않습니다.

## 로컬·자동 생성 항목

다음 항목은 현재 작업 폴더에 생길 수 있지만 프로젝트 소스가 아니거나 비밀정보이므로 내부 파일을 문서에서 열거하지 않습니다.

| 항목 | 역할과 관리 방법 |
|---|---|
| <code>.env</code> | 실제 DB URL·비밀키가 들어가는 로컬 파일입니다. <code>.env.example</code>에서 만들고 절대 커밋하지 않습니다. |
| <code>.next/</code> | Next.js 개발·빌드 결과와 라우트 타입 캐시입니다. 삭제해도 다시 생성됩니다. |
| <code>node_modules/</code> | npm 설치 의존성입니다. <code>npm ci</code>로 다시 생성합니다. |
| <code>next-dev.log</code>, <code>next-dev.err.log</code> | 개발 서버의 표준 출력·오류 로그입니다. |
| <code>tsconfig.tsbuildinfo</code> | TypeScript 증분 타입 검사 캐시입니다. |
| <code>.git/</code> | 커밋·브랜치·객체를 보관하는 Git 내부 메타데이터입니다. 직접 편집하지 않습니다. |
| <code>.agents/</code> | 로컬 자동화 도구가 사용할 수 있는 보조 작업 디렉터리이며 애플리케이션 런타임에는 필요하지 않습니다. |

<code>coverage/</code>, <code>out/</code>, <code>dist/</code>, <code>*.log</code>, <code>*.tsbuildinfo</code>와 <code>prisma/dev.db</code>도 <code>.gitignore</code>에 등록된 재생성 가능 항목입니다.

## 추가 문서

- 처음 프로젝트 맥락을 파악할 때: <code>docs/00_project_overview.md</code>
- 현재 구현 범위를 확인할 때: <code>docs/09_current_implementation_status.md</code>
- DB를 생성·변경·복구할 때: <code>docs/11_database_migrations.md</code>
- 보안과 백업 원칙을 확인할 때: <code>docs/06_security_backup_policy.md</code>
