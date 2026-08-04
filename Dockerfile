# syntax=docker/dockerfile:1

# Node.js 버전을 모든 단계에서 동일하게 유지한다.
# 현재 Prisma 의존성의 엔진 요구사항에 맞춰 Node.js 22 LTS를 사용한다.
FROM node:22-alpine AS base
WORKDIR /app

# CI와 이미지 빌드에서 Next.js 익명 텔레메트리를 전송하지 않는다.
ENV NEXT_TELEMETRY_DISABLED=1


# package-lock.json에 고정된 의존성을 한 번만 설치해 후속 단계가 공유한다.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# DB 스키마 적용만 담당하는 일회성 이미지다.
# 애플리케이션 시작 전에 Compose의 migrate 서비스가 이 단계를 실행한다.
FROM deps AS migrator
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./prisma.config.ts
COPY --chown=node:node docker/migrate-entrypoint.sh ./docker/migrate-entrypoint.sh
RUN chmod +x ./docker/migrate-entrypoint.sh
USER node
ENTRYPOINT ["./docker/migrate-entrypoint.sh"]


# Next.js standalone 서버를 생성하는 빌드 단계다.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 실제 접속 정보는 빌드 이미지에 넣지 않는다. Prisma Client 생성과 Next.js의
# 모듈 분석에만 사용하는 비밀이 아닌 더미 URL이며, 실행 시 Compose 값으로 대체된다.
ENV DATABASE_URL="postgresql://build_user:build_password@127.0.0.1:5432/build_db?schema=public"
ENV DIRECT_URL="postgresql://build_user:build_password@127.0.0.1:5432/build_db?schema=public"

# package.json의 prebuild가 Prisma Client를 생성하므로 별도 generate를 중복 실행하지 않는다.
RUN npm run build


# 운영 컨테이너에는 standalone 결과와 정적 파일만 넣는다.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 컨테이너 자체 HEALTHCHECK에서 HTTP 상태를 확인할 때 사용한다.
RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 애플리케이션 프로세스는 root 권한으로 실행하지 않는다.
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
