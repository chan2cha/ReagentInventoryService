import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReceivingTemplate } from "@/lib/receiving-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  if (user.mustChangePassword || !can(user.role, "STOCK_WRITE")) {
    return Response.json({ message: "입고 등록 권한이 없습니다." }, { status: 403 });
  }

  const [allergens, warehouses] = await Promise.all([
    prisma.allergen.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: [{ category: "asc" }, { code: "asc" }]
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);
  if (allergens.length === 0 || warehouses.length === 0) {
    return Response.json(
      { message: "활성 시약과 창고를 먼저 등록하세요." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await buildReceivingTemplate(allergens, warehouses);
  return new Response(new Uint8Array(data), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": "attachment; filename=receiving-import-template.xlsx; filename*=UTF-8''%EC%9E%85%EA%B3%A0%EB%93%B1%EB%A1%9D_%ED%85%9C%ED%94%8C%EB%A6%BF.xlsx",
      "Content-Type": EXCEL_MIME_TYPE,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
