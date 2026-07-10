import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { koreaDateKey } from "@/lib/date";

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

export async function getUserRows(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [
      { isActive: "desc" },
      { createdAt: "asc" }
    ],
    select: {
      id: true,
      loginId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true
    }
  });

  return users.map((user) => ({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    email: user.email ?? "-",
    role: user.role,
    roleLabel: roleLabels[user.role],
    active: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: koreaDateKey(user.createdAt)
  }));
}
