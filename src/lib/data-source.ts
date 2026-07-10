export function canUseSampleData() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_SAMPLE_DATA === "true";
}

export function handleDataSourceError<T>(scope: string, error: unknown, sampleData: () => T): T {
  console.error(`[data-source:${scope}] database query failed`, error);

  if (canUseSampleData()) {
    return sampleData();
  }

  throw new Error("DATA_SOURCE_UNAVAILABLE", { cause: error });
}
