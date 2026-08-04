#!/bin/sh
set -eu

# PostgreSQL 공식 이미지의 최초 초기화에서는 임시 서버가 잠깐 열렸다가
# 실제 서버로 교체된다. 느린 NAS 디스크에서도 이 짧은 구간을 안전하게
# 통과하도록 migrate deploy를 제한된 횟수만 재시도한다.
max_attempts="${MIGRATION_MAX_ATTEMPTS:-10}"
retry_seconds="${MIGRATION_RETRY_SECONDS:-3}"
attempt=1

while true; do
  if ./node_modules/.bin/prisma migrate deploy; then
    exit 0
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Migration failed after ${max_attempts} attempts." >&2
    exit 1
  fi

  echo "Database is not ready; retrying migration in ${retry_seconds}s (${attempt}/${max_attempts})." >&2
  attempt=$((attempt + 1))
  sleep "$retry_seconds"
done
