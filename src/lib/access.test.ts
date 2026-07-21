import { describe, expect, it } from "vitest";
import { can, isRoleAllowed } from "./access";

describe("role access", () => {
  it("allows explicitly assigned roles", () => {
    expect(isRoleAllowed("ORDER_MANAGER", ["ADMIN", "ORDER_MANAGER"])).toBe(true);
  });

  it("rejects roles that are not assigned to an operation", () => {
    expect(isRoleAllowed("VIEWER", ["ADMIN", "SHIPMENT_MANAGER"])).toBe(false);
  });
});

describe("business capabilities", () => {
  it("allows order managers to change orders but not shipments", () => {
    expect(can("ORDER_MANAGER", "ORDER_WRITE")).toBe(true);
    expect(can("ORDER_MANAGER", "SHIPMENT_WRITE")).toBe(false);
  });

  it("allows shipment managers to receive, adjust, and ship stock", () => {
    expect(can("SHIPMENT_MANAGER", "STOCK_WRITE")).toBe(true);
    expect(can("SHIPMENT_MANAGER", "SHIPMENT_WRITE")).toBe(true);
    expect(can("SHIPMENT_MANAGER", "ORDER_WRITE")).toBe(false);
  });

  it("allows operational managers to export data but keeps viewers out", () => {
    expect(can("ADMIN", "DATA_EXPORT")).toBe(true);
    expect(can("ORDER_MANAGER", "DATA_EXPORT")).toBe(true);
    expect(can("SHIPMENT_MANAGER", "DATA_EXPORT")).toBe(true);
    expect(can("VIEWER", "DATA_EXPORT")).toBe(false);
  });

  it("keeps viewers read-only and administrators unrestricted", () => {
    const capabilities = ["ORDER_WRITE", "STOCK_WRITE", "SHIPMENT_WRITE", "MASTER_WRITE", "USER_ADMIN", "AUDIT_READ", "DATA_EXPORT"] as const;
    expect(capabilities.every((capability) => !can("VIEWER", capability))).toBe(true);
    expect(capabilities.every((capability) => can("ADMIN", capability))).toBe(true);
  });
});
