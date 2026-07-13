/** 개발 환경에서만 명시적으로 허용된 경우에 한해 샘플 데이터로 대체한다. */
export function canUseSampleData() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_SAMPLE_DATA === "true";
}

/** 운영 환경에서는 실제 장애를 숨기지 않고 표준 오류로 변환한다. */
export function handleDataSourceError<T>(scope: string, error: unknown, sampleData: () => T): T {
  console.error(`[data-source:${scope}] database query failed`, error);

  if (canUseSampleData()) {
    return sampleData();
  }

  throw new Error("DATA_SOURCE_UNAVAILABLE", { cause: error });
}
