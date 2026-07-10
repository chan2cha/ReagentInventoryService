import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function runtimeDatabaseUrl(url: string | undefined) {
  if (!url || !url.includes(":6543")) return url;

  const additions: string[] = [];
  if (!url.includes("pgbouncer=")) additions.push("pgbouncer=true");
  if (!url.includes("connection_limit=")) additions.push("connection_limit=3");
  if (!url.includes("pool_timeout=")) additions.push("pool_timeout=30");
  if (additions.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${additions.join("&")}`;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: runtimeDatabaseUrl(process.env.DATABASE_URL)
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
