import { afterEach, describe, expect, it, vi } from "vitest";
import { canUseSampleData, handleDataSourceError } from "./data-source";

describe("data source fallback policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("requires an explicit development opt-in", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SAMPLE_DATA", "true");
    expect(canUseSampleData()).toBe(true);
  });

  it("never enables sample fallback in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SAMPLE_DATA", "true");
    expect(canUseSampleData()).toBe(false);
  });

  it("throws instead of presenting sample data without opt-in", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SAMPLE_DATA", "false");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => handleDataSourceError("test", new Error("offline"), () => ["sample"])).toThrow("DATA_SOURCE_UNAVAILABLE");
  });
});
