import type { UserRole } from "@prisma/client";

export type Capability =
  | "ORDER_WRITE"
  | "STOCK_WRITE"
  | "SHIPMENT_WRITE"
  | "MASTER_WRITE"
  | "USER_ADMIN"
  | "AUDIT_READ"
  | "DATA_EXPORT";

const capabilityRoles: Record<Capability, UserRole[]> = {
  ORDER_WRITE: ["ADMIN", "ORDER_MANAGER"],
  STOCK_WRITE: ["ADMIN", "SHIPMENT_MANAGER"],
  SHIPMENT_WRITE: ["ADMIN", "SHIPMENT_MANAGER"],
  MASTER_WRITE: ["ADMIN"],
  USER_ADMIN: ["ADMIN"],
  AUDIT_READ: ["ADMIN"],
  DATA_EXPORT: ["ADMIN", "ORDER_MANAGER", "SHIPMENT_MANAGER"]
};

export function isRoleAllowed(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}

export function can(role: UserRole, capability: Capability) {
  return capabilityRoles[capability].includes(role);
}
