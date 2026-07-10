# 서버 배포 및 운영 설계서

## 1. 초기 운영 환경

회사에 별도 NAS나 서버가 없는 초기 단계이므로, 직접 서버를 운영하기보다 클라우드 서비스를 사용한다.

추천 구조는 다음과 같다.

```text
사용자 브라우저
    ↓
Vercel - Next.js 웹서비스
    ↓
Supabase PostgreSQL
```

## 2. 선택 기술

| 영역 | 선택 |
|---|---|
| 프론트엔드/백엔드 | Next.js |
| 언어 | TypeScript |
| DB | PostgreSQL |
| ORM | Prisma |
| DB 호스팅 | Supabase PostgreSQL |
| 웹 배포 | Vercel |
| 테스트 | Vitest |

## 3. 배포 흐름

1. 개발자가 로컬에서 개발한다.
2. GitHub 저장소에 코드를 올린다.
3. Vercel이 GitHub 저장소를 기준으로 자동 배포한다.
4. Vercel 환경변수에 DB 접속 정보와 인증 키를 저장한다.
5. Supabase PostgreSQL에 마이그레이션을 적용한다.
6. 운영 배포 전 테스트와 빌드를 수행한다.

## 4. 환경 구분

최소한 다음 환경을 구분한다.

| 환경 | 용도 |
|---|---|
| local | 개발자 로컬 개발 |
| production | 실제 회사 운영 |

가능하면 추후 staging 환경을 추가한다.

| 환경 | 용도 |
|---|---|
| staging | 운영 배포 전 검증 |

## 5. 환경변수

운영 환경변수는 Vercel에 저장한다. 코드 저장소에는 올리지 않는다.

| 변수 | 설명 |
|---|---|
| DATABASE_URL | PostgreSQL 접속 URL |
| AUTH_SECRET | 세션/인증 암호화 키 |
| AUTH_URL | 서비스 URL |
| APP_ENV | 실행 환경 |

## 6. 배포 전 검증 명령

배포 전 다음 명령을 통과해야 한다.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx prisma validate
npx prisma generate
```

DB 마이그레이션은 운영 반영 전 반드시 검토한다.

```bash
npx prisma migrate deploy
```

## 7. 백업 정책

| 구분 | 정책 |
|---|---|
| 자동 백업 | 매일 1회 |
| 수동 백업 | 주요 배포 전 1회 |
| 월말 백업 | 별도 보관 |
| 보관 기간 | 최소 30일 |
| 보관 위치 | 클라우드 + 관리자 PC 등 2곳 이상 |

## 8. 장애 대응 원칙

| 상황 | 대응 |
|---|---|
| 웹서비스 접속 불가 | Vercel 배포 상태 확인 |
| DB 접속 오류 | Supabase 상태 및 DATABASE_URL 확인 |
| 잘못된 재고 변경 | StockMovement 이력 확인 후 조정 처리 |
| 배포 후 오류 | 이전 배포 버전으로 롤백 |
| 데이터 손상 | 최신 백업으로 복구 검토 |

## 9. 향후 이전 가능성

초기에는 Vercel + Supabase로 운영한다. 추후 다음 요구가 생기면 VPS 또는 사내 서버로 이전할 수 있다.

- 회사 IP에서만 접속 허용 필요
- VPN 기반 내부망 접근 필요
- DB와 애플리케이션을 한 서버에서 통제하고 싶음
- 더 강한 보안 정책 필요

이전 후보 구조:

```text
VPS 또는 사내 서버
    ├── Docker Compose
    ├── Next.js App
    ├── PostgreSQL
    └── Nginx
```
