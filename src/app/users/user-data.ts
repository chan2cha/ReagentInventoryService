import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { koreaDateKey } from "@/lib/date";
import { PAGE_SIZE,pageMeta,type PaginatedResult } from "@/lib/pagination";

export type UserRow = {
  id: string;
  loginId: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

export const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "관리자" },
  { value: "ORDER_MANAGER", label: "주문관리" },
  { value: "SHIPMENT_MANAGER", label: "출고담당" },
  { value: "VIEWER", label: "조회" }
];

const roleLabels = Object.fromEntries(roleOptions.map((role) => [role.value, role.label])) as Record<UserRole, string>;

export async function getUserRows(page:number, q = ""): Promise<PaginatedResult<UserRow>> {
  const where = q ? { OR: [
    { loginId: { contains: q, mode: "insensitive" as const } },
    { name: { contains: q, mode: "insensitive" as const } },
    { email: { contains: q, mode: "insensitive" as const } }
  ] } : {};
  const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
  const userQuery = {
    where,
    orderBy: [
      { isActive: "desc" },
      { createdAt: "asc" }
    ],
    skip:requestedSkip,take:PAGE_SIZE,select: {
      id: true,
      loginId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true
    }
  } satisfies Prisma.UserFindManyArgs;
  const [total, initialUsers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany(userQuery)
  ]);
  const meta=pageMeta(page,total);
  const users = meta.skip === requestedSkip
    ? initialUsers
    : await prisma.user.findMany({ ...userQuery, skip: meta.skip });

  return {...meta,rows:users.map((user) => ({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    email: user.email ?? "-",
    role: user.role,
    roleLabel: roleLabels[user.role],
    active: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: koreaDateKey(user.createdAt)
  }))};
}
