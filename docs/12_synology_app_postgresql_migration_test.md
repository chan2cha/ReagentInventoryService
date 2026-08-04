# Synology NAS 애플리케이션·PostgreSQL 이전 검증 절차

이 문서는 현재 **Vercel + Supabase**에서 동작하는 알레르기 시약 재고관리 서비스를 개인 Synology NAS로 복제하여 다음 항목을 검증하기 위한 절차다.

- Next.js 애플리케이션 컨테이너 실행
- PostgreSQL 컨테이너 실행
- Prisma 마이그레이션 적용
- 내부망 접속
- 데이터 영속성
- 백업 및 복구
- NAS 재부팅 후 자동 복구
- 이후 친구 회사 Windows 서버컴으로의 재이식 가능성

개인 NAS는 **이전 검증 및 단기 테스트 환경**으로만 사용한다. 최종 운영 환경은 친구 회사 서버컴이며, 회사 서버 이전이 완료되면 개인 NAS에 남아 있는 회사 데이터는 삭제한다.

---

## 0. 전체 이전 계획

### 현재 환경

```text
사용자
  ↓
Vercel의 Next.js 애플리케이션
  ↓
Supabase PostgreSQL
```

### 개인 NAS 테스트 환경

```text
같은 내부망의 테스트 PC
  ↓ http://NAS_IP:31000
Synology Container Manager
  ├─ Next.js 애플리케이션 컨테이너
  └─ PostgreSQL 컨테이너
```

### 최종 회사 운영 환경

```text
회사 직원 PC
  ↓ http://회사_서버_IP:31000
회사 Windows 서버컴
  └─ Docker Desktop
      ├─ Next.js 애플리케이션 컨테이너
      └─ PostgreSQL 컨테이너

회사 NAS
  └─ PostgreSQL 백업 파일
```

### 전환 원칙

1. 개인 NAS 검증이 끝날 때까지 Vercel과 Supabase를 삭제하지 않는다.
2. 검증 기간에는 Supabase 또는 NAS 중 하나만 입력 기준 DB로 사용한다.
3. 두 DB에 동시에 실제 입고·주문·출고 데이터를 입력하지 않는다.
4. 회사 서버 이전 시 같은 Docker 이미지와 Compose 구성을 재사용한다.
5. 운영 데이터는 최종적으로 회사 장비에만 남긴다.

---

# 1. 사전 조건 확인

## 1.1 Synology NAS

DSM에서 다음 항목을 확인한다.

```text
제어판
→ 정보 센터
```

확인 항목:

- NAS 모델명
- DSM 버전
- CPU 아키텍처
- 설치 메모리
- 사용 가능한 저장공간

패키지 센터에서 다음 패키지가 설치되어 있어야 한다.

```text
Container Manager
```

권장 조건:

```text
DSM: 7.x
RAM: 최소 4GB, 권장 8GB 이상
저장공간: 최소 20GB 이상 여유
CPU: x86_64 또는 arm64
```

## 1.2 개발 PC

다음 도구가 준비되어 있어야 한다.

```text
Git
Node.js
npm
Docker Desktop
PostgreSQL client 또는 Supabase CLI
```

확인 명령:

```powershell
git --version
node --version
npm --version
docker --version
docker compose version
pg_dump --version
pg_restore --version
```

## 1.3 저장소

프로젝트 저장소에는 최소한 다음 파일이 필요하다.

```text
Dockerfile
compose.yaml 또는 docker-compose.yml
next.config.ts
prisma/schema.prisma
prisma/migrations/
.env.example
```

Next.js Docker 실행을 위해 `next.config.ts`에는 standalone 출력 설정을 권장한다.

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NAS, VPS, Windows 서버에서 동일한 Docker 이미지로 실행하기 위한 설정
  output: "standalone",
};

export default nextConfig;
```

---

# 2. 기존 Vercel·Supabase 환경 보호

NAS 검증이 끝날 때까지 기존 환경은 그대로 유지한다.

## 2.1 변경하지 않을 항목

- Vercel Production 환경변수
- Supabase 운영 또는 MVP DB
- 현재 GitHub main 브랜치 배포 설정
- 기존 서비스 URL

## 2.2 Git 브랜치 권장

NAS 테스트 작업은 별도 브랜치에서 진행한다.

```powershell
git checkout -b infra/synology-test
```

Docker 관련 파일을 추가한 뒤 검증이 끝나면 main 브랜치 반영 여부를 결정한다.

## 2.3 비밀값 주의

아래 파일과 값은 Git에 커밋하지 않는다.

```text
.env
.env.nas
DATABASE_URL
DIRECT_URL
POSTGRES_PASSWORD
AUTH_SECRET
Supabase DB 비밀번호
```

`.gitignore` 예시:

```gitignore
.env
.env.*
!.env.example
!.env.nas.example

data/
backups/
```

---

# 3. NAS 배포 디렉터리 준비

DSM File Station에서 다음 폴더를 만든다.

```text
/volume1/docker/reagent-inventory-test/
├─ project/
├─ data/
│  └─ postgres/
└─ backups/
```

역할:

```text
project   애플리케이션 소스와 Compose 파일
data      PostgreSQL 실제 데이터
backups   DB dump 및 복구 테스트 파일
```

Container Manager가 위 폴더를 읽고 쓸 수 있어야 한다.

---

# 4. NAS용 환경변수 파일 작성

저장소에 `.env.nas.example`을 추가한다.

```env
# PostgreSQL
POSTGRES_USER=reagent_app
POSTGRES_PASSWORD=CHANGE_TO_LONG_RANDOM_PASSWORD
POSTGRES_DB=reagent_inventory

# Next.js
APP_PORT=31000
NAS_IP=192.168.0.58
AUTH_SECRET=CHANGE_TO_LONG_RANDOM_AUTH_SECRET
AUTH_URL=http://192.168.0.58:31000

# 환경 구분
APP_ENV=nas-test
```

NAS 프로젝트 폴더에서는 이를 `.env`로 복사한다.

```text
/volume1/docker/reagent-inventory-test/project/.env
```

주의사항:

- `POSTGRES_PASSWORD`는 길고 예측하기 어렵게 설정한다.
- 테스트 초기에는 URL 인코딩 문제를 피하기 위해 공백과 URL 예약 문자를 피한다.
- `AUTH_URL`은 실제 NAS 내부 IP와 앱 포트로 설정한다.
- `.env` 파일을 GitHub에 올리지 않는다.

랜덤 값 생성 예시:

```powershell
# AUTH_SECRET 예시
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(48)
)
```

---

# 5. Docker Compose 작성

`deploy/nas/compose.yaml` 또는 프로젝트 루트의 `compose.yaml`을 다음 구조로 작성한다.

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: reagent-inventory-db
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: Asia/Seoul

    volumes:
      # 컨테이너를 재생성해도 DB 데이터가 유지된다.
      - ../data/postgres:/var/lib/postgresql/data

      # dump 파일을 넣고 꺼내기 위한 폴더다.
      - ../backups:/backups

    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
        ]
      interval: 10s
      timeout: 5s
      retries: 10

    # 중요:
    # PostgreSQL 포트는 NAS 외부에 공개하지 않는다.
    # 앱 컨테이너가 Docker 내부 네트워크에서 db:5432로 접근한다.

  app:
    build:
      context: .
      dockerfile: Dockerfile

    container_name: reagent-inventory-app
    restart: unless-stopped

    depends_on:
      db:
        condition: service_healthy

    environment:
      NODE_ENV: production
      APP_ENV: ${APP_ENV}

      # localhost 또는 NAS IP가 아니라 Compose 서비스명 db를 사용한다.
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      DIRECT_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public

      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL}

    ports:
      # 내부 PC는 NAS_IP:31000으로 접속한다.
      - "${APP_PORT}:3000"

    healthcheck:
      test:
        [
          "CMD-SHELL",
          "wget -qO- http://127.0.0.1:3000/api/health || exit 1"
        ]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 5
```

## 경로 주의

Compose 파일 위치에 따라 바인드 마운트 상대경로가 달라질 수 있다.

가장 단순한 구성은 다음 파일을 모두 같은 상위 프로젝트 폴더에 두는 것이다.

```text
reagent-inventory-test/
├─ project/
│  ├─ compose.yaml
│  ├─ Dockerfile
│  ├─ .env
│  ├─ package.json
│  ├─ prisma/
│  └─ src/
├─ data/
│  └─ postgres/
└─ backups/
```

`compose.yaml`이 `project` 안에 있다면 위 예시처럼 `../data`, `../backups`를 사용한다.

---

# 6. Dockerfile 확인

Next.js standalone 빌드를 기준으로 다음 구조를 사용한다.

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client 생성
RUN npx prisma generate

# Next.js production build
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# healthcheck에 사용
RUN apk add --no-cache wget

# root가 아닌 사용자로 실행
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma migration 실행에 필요한 파일
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
```

## Health API

프로젝트에 health API가 없다면 추가한다.

```ts
// src/app/api/health/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 애플리케이션 프로세스와 PostgreSQL 연결 상태를 함께 확인한다.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      status: "healthy",
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
      },
      {
        status: 503,
      },
    );
  }
}
```

---

# 7. 로컬에서 Docker 빌드 검증

NAS에 올리기 전에 Windows 개발 PC에서 먼저 검증한다.

```powershell
cd C:\Users\chan\workspaces\ReagentInventoryService
```

빌드:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml build
```

DB 실행:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml up -d db
```

Prisma 마이그레이션:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml run --rm app `
  npx prisma migrate deploy
```

전체 실행:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml up -d
```

상태 확인:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml ps
```

로그 확인:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml logs -f app
```

브라우저:

```text
http://localhost:31000
```

종료:

```powershell
docker compose --env-file .env.nas -f deploy\nas\compose.yaml down
```

주의:

```powershell
docker compose down -v
```

는 DB 볼륨 삭제 위험이 있으므로 사용하지 않는다.

---

# 8. 프로젝트를 NAS에 업로드

## 방법 A: ZIP 업로드

로컬 프로젝트를 압축할 때 다음 폴더는 제외한다.

```text
node_modules
.next
.git
data
backups
.env
```

NAS의 다음 경로에 압축을 푼다.

```text
/volume1/docker/reagent-inventory-test/project
```

이후 NAS에서 별도로 `.env`를 생성한다.

## 방법 B: Git clone

DSM에서 SSH를 임시 활성화한다.

```text
제어판
→ 터미널 및 SNMP
→ SSH 서비스 활성화
```

NAS 접속:

```powershell
ssh 사용자명@NAS_IP
```

저장소 복제:

```bash
cd /volume1/docker/reagent-inventory-test
git clone <GITHUB_REPOSITORY_URL> project
```

Private 저장소라면 전용 deploy key 또는 제한된 Personal Access Token을 사용한다.

작업이 끝나면 SSH를 비활성화하거나 접근 범위를 제한한다.

---

# 9. Container Manager 프로젝트 생성

DSM에서 다음으로 이동한다.

```text
Container Manager
→ 프로젝트
→ 생성
```

설정 예시:

```text
프로젝트 이름: reagent-inventory-test
프로젝트 경로: /volume1/docker/reagent-inventory-test/project
Compose 파일: compose.yaml
```

프로젝트를 생성하고 빌드를 시작한다.

확인할 컨테이너:

```text
reagent-inventory-db
reagent-inventory-app
```

정상 상태:

```text
db  healthy
app healthy
```

빌드가 실패하면 Container Manager 프로젝트 로그를 확인한다.

---

# 10. 빈 PostgreSQL에 Prisma 마이그레이션 적용

처음에는 Supabase 데이터를 복원하지 않고 빈 DB로 검증하는 것을 권장한다.

Container Manager 터미널 또는 NAS SSH에서 프로젝트 폴더로 이동한다.

```bash
cd /volume1/docker/reagent-inventory-test/project
```

DB만 실행:

```bash
sudo docker compose up -d db
```

앱 이미지 빌드:

```bash
sudo docker compose build app
```

마이그레이션 상태 확인:

```bash
sudo docker compose run --rm app npx prisma migrate status
```

마이그레이션 적용:

```bash
sudo docker compose run --rm app npx prisma migrate deploy
```

다시 상태 확인:

```bash
sudo docker compose run --rm app npx prisma migrate status
```

Prisma Client 생성은 이미지 빌드 단계에서 실행하지만, 필요하면 다음으로 확인한다.

```bash
sudo docker compose run --rm app npx prisma generate
```

빈 DB 테스트에서는 다음을 사용하지 않는다.

```text
prisma migrate dev
prisma db push
prisma migrate resolve --applied
```

샘플 데이터가 필요하지 않다면 seed도 실행하지 않는다.

```text
npm run prisma:seed 실행 안 함
```

로그인 검증이 필요하면 테스트 전용 관리자 계정만 별도 생성하고, 테스트 종료 후 삭제한다.

---

# 11. Next.js 앱 실행 및 내부 접속

앱 실행:

```bash
sudo docker compose up -d app
```

전체 상태:

```bash
sudo docker compose ps
```

앱 로그:

```bash
sudo docker compose logs -f app
```

DB 로그:

```bash
sudo docker compose logs -f db
```

NAS와 같은 내부망의 PC에서 접속한다.

```text
http://NAS_IP:31000
```

예:

```text
http://192.168.0.58:31000
```

PowerShell 포트 확인:

```powershell
Test-NetConnection 192.168.0.58 -Port 31000
```

정상 결과:

```text
TcpTestSucceeded : True
```

---

# 12. Synology 방화벽 설정

DSM에서 다음으로 이동한다.

```text
제어판
→ 보안
→ 방화벽
```

앱 포트만 내부망에 허용한다.

```text
프로토콜: TCP
포트: 31000
소스 IP: 신뢰하는 내부망 대역
예: 192.168.0.0/24
동작: 허용
```

하지 말아야 할 설정:

```text
공유기에서 31000 포트포워딩
PostgreSQL 5432 외부 공개
DSM 5000/5001 인터넷 직접 공개
QuickConnect로 PostgreSQL 공개
```

PostgreSQL은 Compose 내부 네트워크에서만 접근한다.

---

# 13. 기능 검증

빈 DB 또는 테스트 seed 기준으로 다음 기능을 확인한다.

## 기본

```text
[ ] 로그인
[ ] 로그아웃
[ ] 권한별 메뉴 접근
[ ] health API 정상
```

## 업무 기능

```text
[ ] 항원 등록
[ ] 제조번호·유통기한별 재고 등록
[ ] 거래처 등록
[ ] 주문 등록
[ ] 출고 처리
[ ] FEFO 기준 LOT 배정
[ ] 재고 자동 차감
[ ] 출고 취소
[ ] 재고 복구
[ ] 입출고 이력 생성
```

## 재고 정합성

예시:

```text
초기 재고: 10
출고: 3
출고 후: 7
출고 취소 후: 10
```

DB에서 직접 확인:

```bash
sudo docker compose exec db psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB"
```

Prisma 테이블 이름에 맞춰 조회한다.

```sql
\dt

SELECT COUNT(*) FROM "Allergen";
SELECT COUNT(*) FROM "ReagentLot";
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "StockMovement";
```

종료:

```sql
\q
```

---

# 14. 선택 사항: Supabase 데이터 복사

빈 DB 검증이 끝난 뒤 현재 Supabase 데이터를 복사해 실제 구조와 데이터로 테스트할 수 있다.

이 작업은 **복사**이며 Supabase 원본 DB를 삭제하거나 변경하지 않는다.

## 14.1 Supabase dump 생성

Supabase의 Direct connection 또는 Session pooler URL을 사용한다.

PowerShell:

```powershell
$env:SUPABASE_DB_URL = Read-Host "Supabase PostgreSQL URL"

pg_dump `
  --format=custom `
  --no-owner `
  --no-acl `
  --dbname="$env:SUPABASE_DB_URL" `
  --file="supabase_backup.dump"

Remove-Item Env:SUPABASE_DB_URL
```

생성 파일:

```text
supabase_backup.dump
```

NAS의 다음 위치에 업로드한다.

```text
/volume1/docker/reagent-inventory-test/backups/supabase_backup.dump
```

## 14.2 NAS DB 복원 전 백업

현재 NAS 테스트 DB가 필요하면 먼저 백업한다.

```bash
sudo docker compose exec db pg_dump \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="/backups/before_supabase_restore.dump"
```

## 14.3 애플리케이션 중지

```bash
sudo docker compose stop app
```

## 14.4 Supabase dump 복원

```bash
sudo docker compose exec db pg_restore \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --exit-on-error \
  /backups/supabase_backup.dump
```

복원 후 저장소 migration과 차이가 없는지 확인한다.

```bash
sudo docker compose run --rm app npx prisma migrate status
sudo docker compose run --rm app npx prisma migrate deploy
```

앱 재시작:

```bash
sudo docker compose up -d app
```

주의:

- Supabase Auth, Storage, Edge Function을 사용한다면 PostgreSQL dump만으로 전부 이전되지 않을 수 있다.
- 자체 `User` 테이블과 Prisma 기반 인증만 사용한다면 일반 PostgreSQL dump로 이전 가능하다.
- 테스트 데이터와 실제 회사 데이터가 섞여 있는지 확인한다.

---

# 15. 데이터 영속성 테스트

컨테이너 재생성 후에도 DB 데이터가 유지되는지 확인한다.

1. 테스트 항원을 하나 등록한다.
2. 현재 데이터 건수를 기록한다.
3. 프로젝트를 중지한다.

```bash
sudo docker compose down
```

4. 다시 실행한다.

```bash
sudo docker compose up -d
```

5. 등록한 데이터가 남아 있는지 확인한다.

주의:

```bash
sudo docker compose down -v
```

는 사용하지 않는다.

현재 구성은 바인드 마운트이므로 `data/postgres` 폴더가 실제 영속 데이터다.

---

# 16. NAS 재부팅 테스트

NAS 재부팅 전에 상태를 기록한다.

```bash
sudo docker compose ps
```

DSM에서 NAS를 재부팅한다.

재부팅 후 확인:

```text
Container Manager
→ 프로젝트
→ reagent-inventory-test
```

검증:

```text
[ ] DB 컨테이너 자동 시작
[ ] 앱 컨테이너 자동 시작
[ ] DB healthy
[ ] 앱 healthy
[ ] 기존 데이터 유지
[ ] 내부 PC에서 재접속 가능
```

`restart: unless-stopped`가 있어도 NAS 및 Container Manager 동작에 따라 실제 자동 시작 여부를 반드시 확인한다.

---

# 17. 백업 생성

백업 파일은 NAS의 다음 위치에 생성한다.

```text
/volume1/docker/reagent-inventory-test/backups
```

백업 명령:

```bash
sudo docker compose exec db pg_dump \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="/backups/reagent_inventory_$(date +%Y%m%d_%H%M%S).dump"
```

백업 확인:

```bash
ls -lh ../backups
```

권장 보관 구조:

```text
backups/
├─ daily/
├─ weekly/
└─ restore-test/
```

테스트 단계에서도 백업 파일을 NAS 한 곳에만 두지 말고 개발 PC에 한 번 복사해본다.

---

# 18. 복구 테스트

백업 파일이 실제로 복구 가능한지 별도 DB에 검증한다.

테스트 DB 생성:

```bash
sudo docker compose exec db createdb \
  -U "$POSTGRES_USER" \
  reagent_inventory_restore_test
```

복구:

```bash
sudo docker compose exec db pg_restore \
  --username="$POSTGRES_USER" \
  --dbname="reagent_inventory_restore_test" \
  --no-owner \
  --no-acl \
  --exit-on-error \
  /backups/백업파일명.dump
```

테이블 확인:

```bash
sudo docker compose exec db psql \
  -U "$POSTGRES_USER" \
  -d reagent_inventory_restore_test \
  -c '\dt'
```

주요 데이터 건수 확인:

```bash
sudo docker compose exec db psql \
  -U "$POSTGRES_USER" \
  -d reagent_inventory_restore_test \
  -c 'SELECT COUNT(*) FROM "ReagentLot";'
```

테스트 DB 삭제:

```bash
sudo docker compose exec db dropdb \
  -U "$POSTGRES_USER" \
  reagent_inventory_restore_test
```

백업 생성 성공만으로 완료 처리하지 않는다. 복구 테스트까지 통과해야 한다.

---

# 19. NAS 테스트 완료 기준

다음 항목이 모두 완료되어야 회사 서버 이전 단계로 넘어간다.

```text
[ ] Next.js 이미지 빌드 성공
[ ] PostgreSQL 컨테이너 실행 성공
[ ] Prisma migrate deploy 성공
[ ] 앱과 DB의 Docker 내부 연결 성공
[ ] 내부망 브라우저 접속 성공
[ ] 로그인 성공
[ ] 항원·재고·주문·출고 기능 정상
[ ] FEFO 배정 정상
[ ] 재고 음수 방지 정상
[ ] StockMovement 이력 정상
[ ] 컨테이너 재생성 후 데이터 유지
[ ] NAS 재부팅 후 자동 실행
[ ] DB dump 생성 성공
[ ] 별도 DB 복구 성공
[ ] 외부 포트포워딩 없음
[ ] DB 포트 외부 공개 없음
```

---

# 20. 친구 회사 서버컴 이전 전 준비

회사 서버컴은 기존 녹취 시스템이 동작하므로 다음을 먼저 완료한다.

```text
[ ] RAM 16GB에서 32GB 이상으로 증설
[ ] Windows 버전 확인
[ ] BIOS 가상화 활성화 여부 확인
[ ] Docker Desktop 설치 가능 여부 확인
[ ] WSL2 또는 Hyper-V 방식 결정
[ ] 기존 녹취 시스템 업체와 충돌 가능성 확인
[ ] 업무 외 시간의 재부팅 가능 시간 확보
[ ] D 드라이브가 로컬 디스크인지 확인
[ ] 회사 NAS의 백업 공유 폴더 준비
```

권장 폴더:

```text
D:\services\ReagentInventoryService\
├─ project\
├─ data\
│  └─ postgres\
└─ backups\
```

---

# 21. NAS에서 회사 서버로 최종 이전

## 21.1 회사 서버에 동일한 프로젝트 배포

회사 서버에서 저장소를 복제한다.

```powershell
cd D:\services
git clone <GITHUB_REPOSITORY_URL> ReagentInventoryService
cd ReagentInventoryService
```

운영용 `.env`를 새로 만든다.

```env
POSTGRES_USER=reagent_app
POSTGRES_PASSWORD=회사_운영용_새_비밀번호
POSTGRES_DB=reagent_inventory

APP_PORT=31000
AUTH_SECRET=회사_운영용_새_AUTH_SECRET
AUTH_URL=http://회사_서버_IP:31000
APP_ENV=production
```

개인 NAS의 비밀번호와 secret을 그대로 재사용하지 않는다.

## 21.2 회사 서버에서 빈 DB 실행

```powershell
docker compose up -d db
docker compose build app
docker compose run --rm app npx prisma migrate deploy
```

## 21.3 NAS 최종 백업

전환 시간을 정한 후 NAS 앱의 입력을 중지한다.

```bash
sudo docker compose stop app
```

최종 백업:

```bash
sudo docker compose exec db pg_dump \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="/backups/final_nas_to_company.dump"
```

`final_nas_to_company.dump` 파일을 회사 서버의 backups 폴더로 복사한다.

## 21.4 회사 서버 PostgreSQL에 복구

회사 서버 PowerShell:

```powershell
docker compose stop app
```

복구:

```powershell
docker compose exec db pg_restore `
  --username=reagent_app `
  --dbname=reagent_inventory `
  --no-owner `
  --no-acl `
  --clean `
  --if-exists `
  --exit-on-error `
  /backups/final_nas_to_company.dump
```

마이그레이션 상태 확인:

```powershell
docker compose run --rm app npx prisma migrate status
docker compose run --rm app npx prisma migrate deploy
```

앱 실행:

```powershell
docker compose up -d app
docker compose ps
```

직원 PC 접속:

```text
http://회사_서버_IP:31000
```

---

# 22. 회사 서버 검증

## 기능 검증

```text
[ ] 로그인
[ ] 항원 조회
[ ] 현재고 확인
[ ] 주문 조회
[ ] 출고 이력 조회
[ ] 테스트 입고
[ ] 테스트 주문
[ ] 테스트 출고
[ ] 출고 취소
```

## 데이터 비교

NAS와 회사 서버에서 주요 테이블 건수를 비교한다.

```sql
SELECT COUNT(*) FROM "Allergen";
SELECT COUNT(*) FROM "ReagentLot";
SELECT COUNT(*) FROM "Client";
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "Shipment";
SELECT COUNT(*) FROM "StockMovement";
```

## 인프라 검증

```text
[ ] 회사 내부 PC 여러 대에서 접속
[ ] Windows 방화벽은 31000만 내부망 허용
[ ] PostgreSQL 포트 외부 공개 없음
[ ] 서버 재부팅 후 Docker Desktop 시작
[ ] 앱·DB 컨테이너 자동 재시작
[ ] 녹취 시스템 정상
[ ] CPU·메모리 사용량 정상
[ ] 회사 NAS로 DB 백업 복사 성공
```

---

# 23. 회사 서버 백업 구성

회사 서버에서 로컬 백업을 생성한 뒤 회사 NAS로 복사한다.

권장 정책:

```text
일간 백업: 14개
주간 백업: 8개
월간 백업: 12개
```

저장 위치:

```text
회사 서버 로컬:
D:\services\ReagentInventoryService\backups

회사 NAS:
\\server\공유폴더\재고관리백업
```

PowerShell 흐름:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "reagent_inventory_$timestamp.dump"

docker compose exec db pg_dump `
  --username=reagent_app `
  --dbname=reagent_inventory `
  --format=custom `
  --no-owner `
  --no-acl `
  --file="/backups/$fileName"

Copy-Item `
  "D:\services\ReagentInventoryService\backups\$fileName" `
  "\\server\공유폴더\재고관리백업\$fileName"
```

Windows 작업 스케줄러에서 매일 자동 실행한다.

---

# 24. 롤백 계획

회사 서버 전환 직후 문제가 발생하면 다음 순서로 되돌린다.

```text
1. 회사 서버 앱 중지
2. 개인 NAS 앱을 다시 시작
3. 사용자에게 NAS 테스트 URL 임시 안내
4. 회사 서버 로그와 DB 상태 확인
5. 문제 수정 후 새로운 전환 시간 결정
```

명령:

```powershell
# 회사 서버
docker compose stop app
```

```bash
# 개인 NAS
sudo docker compose up -d app
```

주의:

- 롤백 후에는 입력 기준 DB를 다시 하나로 고정한다.
- 회사 서버와 NAS 양쪽에서 동시에 신규 입출고를 처리하지 않는다.
- 전환 직후 일정 기간 NAS 최종 백업을 보관한다.

---

# 25. 개인 NAS 정리

회사 서버 운영이 안정화된 후 다음 순서로 개인 NAS를 정리한다.

1. 회사 서버 백업과 복구 테스트를 완료한다.
2. 회사가 정상 운영 확인을 승인한다.
3. 개인 NAS의 최종 dump를 회사에 인계한다.
4. 개인 NAS의 앱 컨테이너를 중지한다.
5. 개인 NAS PostgreSQL 컨테이너를 중지한다.
6. 프로젝트 폴더의 `.env`를 삭제한다.
7. 회사 데이터가 들어 있는 `data/postgres`를 삭제한다.
8. 회사 데이터가 들어 있는 `backups`를 삭제한다.
9. 불필요한 Docker 이미지와 컨테이너를 정리한다.

삭제 전에는 반드시 회사 서버의 복구 가능 상태를 다시 확인한다.

---

# 26. 장애 확인 순서

## 앱이 열리지 않을 때

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 app
```

확인 항목:

```text
앱 컨테이너 실행 여부
31000 포트 충돌
AUTH_URL 값
NAS 방화벽
Next.js 빌드 오류
```

## DB 연결 오류

```bash
sudo docker compose logs --tail=200 db
sudo docker compose exec db pg_isready \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB"
```

확인 항목:

```text
DATABASE_URL의 host가 db인지
POSTGRES_USER/DB/PASSWORD 일치 여부
data 디렉터리 권한
DB healthcheck
```

## Prisma 오류

```bash
sudo docker compose run --rm app npx prisma validate
sudo docker compose run --rm app npx prisma migrate status
sudo docker compose run --rm app npx prisma generate
```

## 데이터가 사라진 것처럼 보일 때

다음 작업을 하지 않았는지 확인한다.

```text
docker compose down -v
data/postgres 폴더 삭제
다른 프로젝트 폴더에서 Compose 실행
POSTGRES_DB 이름 변경
새로운 빈 data 디렉터리 연결
```

기존 `data/postgres` 폴더를 먼저 보존하고 원인을 확인한다.

---

# 27. 최종 운영 원칙

```text
1. PostgreSQL 포트는 외부에 공개하지 않는다.
2. 앱 포트는 내부망에만 허용한다.
3. 한 시점에 하나의 DB만 입력 원본으로 사용한다.
4. 운영 DB에는 prisma migrate deploy만 사용한다.
5. 실제 데이터 변경 전 백업한다.
6. 백업은 반드시 복구 테스트한다.
7. 개인 NAS는 이전 검증 후 회사 서버로 넘긴다.
8. 회사 서버 안정화 후 개인 NAS의 회사 데이터를 삭제한다.
9. Vercel과 Supabase는 회사 서버 검증이 끝난 뒤 정리한다.
10. 기존 녹취 시스템에 영향을 주지 않는지 지속적으로 확인한다.
```
