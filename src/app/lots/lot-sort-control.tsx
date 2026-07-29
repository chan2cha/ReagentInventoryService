"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { LotStatusFilter } from "@/domain/lot-status";
import type { WarehouseKind } from "@/domain/warehouse";
import type { LotSortKind } from "./lot-data";

type LotSortControlProps = {
  defaultSort: LotSortKind;
  options: readonly {
    label: string;
    value: LotSortKind;
  }[];
  q?: string;
  sort: LotSortKind;
  status?: LotStatusFilter;
  warehouse?: WarehouseKind;
};

export function LotSortControl({
  defaultSort,
  options,
  q,
  sort,
  status,
  warehouse
}: LotSortControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSortChange(nextSort: LotSortKind) {
    if (nextSort === sort) return;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (warehouse) params.set("warehouse", warehouse);
    if (nextSort !== defaultSort) params.set("sort", nextSort);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/lots?${query}` : "/lots");
    });
  }

  return (
    <div
      aria-busy={isPending}
      aria-label="입고분 목록 정렬"
      className="lot-sort-control"
    >
      <label>
        정렬
        <select
          disabled={isPending}
          onChange={(event) => handleSortChange(event.target.value as LotSortKind)}
          value={sort}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
