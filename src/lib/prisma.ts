import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function runtimeDatabaseUrl(url: string | undefined) {
  if (!url || !url.includes(":6543")) {
    return url;
  }

  // Supabase Transaction Pooler 사용 시 추가
  // Supabase transaction pooler URL에 빠진 안전 기본값만 추가한다.
  // 명시된 운영 값은 덮어쓰지 않으며 self-hosted PostgreSQL(:5432)은 변경하지 않는다.
  const defaults = [
    ["pgbouncer", "true"],
    ["connection_limit", "3"],
    ["pool_timeout", "30"],
  ] as const;
  const missing = defaults.filter(([key]) => !url.includes(`${key}=`));

  if (missing.length === 0) {
    return url;
  }

  const query = missing.map(([key, value]) => `${key}=${value}`).join("&");
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function createPrismaClient() {
  const connectionString = runtimeDatabaseUrl(
    process.env.DATABASE_URL
  );

  if (!connectionString) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  }

  const adapter = new PrismaPg({
    connectionString,

    // 기존 connection_limit=3에 대응
    max: 3,

    // 기존 pool_timeout=30에 대응
    connectionTimeoutMillis: 30_000,

    // 선택 사항: 사용하지 않는 연결 정리
    idleTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
