// src/app/api/health/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 애플리케이션 프로세스와 PostgreSQL 연결 상태를 함께 확인한다.
 */
export async function GET() {
  try {
    // 단순 연결뿐 아니라 마이그레이션이 만든 필수 설정 행까지 확인한다.
    // 테이블이 없거나 default 정책이 삭제되면 503을 반환해 준비되지 않은
    // 컨테이너가 정상 상태로 표시되는 것을 방지한다.
    await prisma.$queryRaw`SELECT 1`;
    const policy = await prisma.replacementPolicy.findUnique({
      where: { id: "default" },
      select: { id: true },
    });

    if (!policy) {
      throw new Error("REPLACEMENT_POLICY_NOT_INITIALIZED");
    }

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
