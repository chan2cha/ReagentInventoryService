import { describe, expect, it } from "vitest";
import { runtimeDatabaseUrl } from "./prisma";

describe("runtime database URL", () => {
  it("adds bounded transaction-pooler settings", () => {
    const url = runtimeDatabaseUrl("postgresql://user:pass@pooler.example.com:6543/postgres?schema=public");
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("connection_limit=3");
    expect(url).toContain("pool_timeout=30");
  });

  it("preserves explicitly configured limits", () => {
    const url = runtimeDatabaseUrl("postgresql://user:pass@pooler.example.com:6543/postgres?connection_limit=5&pool_timeout=60&pgbouncer=true");
    expect(url).not.toContain("connection_limit=3");
    expect(url).toBe("postgresql://user:pass@pooler.example.com:6543/postgres?connection_limit=5&pool_timeout=60&pgbouncer=true");
  });
});
