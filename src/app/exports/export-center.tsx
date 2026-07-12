"use client";

import { Boxes, History } from "lucide-react";
import { useState } from "react";
import { LOT_STATUS_KINDS, lotStatusLabel } from "@/domain/lot-status";
import { ExportDownloadButton } from "./export-download-button";

const movementTypes = [
  { label: "입고", value: "IN" },
  { label: "출고", value: "OUT" },
  { label: "조정", value: "ADJUST" },
  { label: "폐기", value: "DISPOSE" },
  { label: "출고취소/복구", value: "REVERSE" }
] as const;

const inventoryStatuses = LOT_STATUS_KINDS.map((status) => ({
  label: lotStatusLabel(status),
  value: status
}));

export function ExportCenter() {
  const [inventoryQ, setInventoryQ] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState("");
  const [movementQ, setMovementQ] = useState("");
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [movementType, setMovementType] = useState("");
  const [includeInventory, setIncludeInventory] = useState(true);
  const [includeMovements, setIncludeMovements] = useState(true);
  const hasInvalidDateRange = Boolean(movementFrom && movementTo && movementFrom > movementTo);
  const selectedDatasets = [
    ...(includeInventory ? ["inventory"] : []),
    ...(includeMovements ? ["movements"] : [])
  ];
  const combinedDisabled = selectedDatasets.length === 0 || (includeMovements && hasInvalidDateRange);

  return (
    <div className="export-center">
      <section aria-labelledby="export-guide-heading" className="export-guide">
        <div>
          <strong id="export-guide-heading">필요한 자료와 조건을 선택하세요.</strong>
          <p>각 자료를 따로 받거나, 선택한 자료를 한 엑셀 파일의 개별 시트로 묶어 받을 수 있습니다.</p>
        </div>
        <span>필터를 비워두면 전체 자료를 내보냅니다.</span>
      </section>

      <div className="export-dataset-grid">
        <article className="export-dataset-card">
          <header>
            <div className="export-dataset-title">
              <span className="export-dataset-icon"><Boxes aria-hidden="true" size={19} /></span>
              <div>
                <h2>재고 현황</h2>
                <p>시약별 제조번호, 유통기한과 현재 수량</p>
              </div>
            </div>
            <label className="export-include-toggle">
              <input
                checked={includeInventory}
                onChange={(event) => setIncludeInventory(event.target.checked)}
                type="checkbox"
              />
              <span>통합 파일에 포함</span>
            </label>
          </header>

          <div className="export-filter-grid">
            <label className="wide" htmlFor="inventory-export-query">
              재고 검색어
              <input
                id="inventory-export-query"
                maxLength={200}
                onChange={(event) => setInventoryQ(event.target.value)}
                placeholder="시약명, 코드, 제조번호 검색"
                type="search"
                value={inventoryQ}
              />
            </label>
            <label className="wide" htmlFor="inventory-export-status">
              재고 상태
              <select
                id="inventory-export-status"
                onChange={(event) => setInventoryStatus(event.target.value)}
                value={inventoryStatus}
              >
                <option value="">전체 상태</option>
                {inventoryStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
          </div>

          <footer>
            <span>현재 입력한 재고 조건만 적용됩니다.</span>
            <ExportDownloadButton
              fallbackFileName="재고-현황.xlsx"
              label="재고 현황 개별 엑셀"
              query={{ report: "inventory", q: inventoryQ, status: inventoryStatus }}
            />
          </footer>
        </article>

        <article className="export-dataset-card">
          <header>
            <div className="export-dataset-title">
              <span className="export-dataset-icon"><History aria-hidden="true" size={19} /></span>
              <div>
                <h2>입출고 이력</h2>
                <p>입고, 출고, 조정, 폐기와 출고취소/복구 기록</p>
              </div>
            </div>
            <label className="export-include-toggle">
              <input
                checked={includeMovements}
                onChange={(event) => setIncludeMovements(event.target.checked)}
                type="checkbox"
              />
              <span>통합 파일에 포함</span>
            </label>
          </header>

          <div className="export-filter-grid movement">
            <label className="wide" htmlFor="movement-export-query">
              이력 검색어
              <input
                id="movement-export-query"
                maxLength={200}
                onChange={(event) => setMovementQ(event.target.value)}
                placeholder="시약명, 코드, 제조번호, 사유 검색"
                type="search"
                value={movementQ}
              />
            </label>
            <label htmlFor="movement-export-from">
              시작일
              <input
                id="movement-export-from"
                max={movementTo || undefined}
                onChange={(event) => setMovementFrom(event.target.value)}
                type="date"
                value={movementFrom}
              />
            </label>
            <label htmlFor="movement-export-to">
              종료일
              <input
                id="movement-export-to"
                min={movementFrom || undefined}
                onChange={(event) => setMovementTo(event.target.value)}
                type="date"
                value={movementTo}
              />
            </label>
            <label className="wide" htmlFor="movement-export-type">
              구분
              <select
                id="movement-export-type"
                onChange={(event) => setMovementType(event.target.value)}
                value={movementType}
              >
                <option value="">전체 구분</option>
                {movementTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
            {hasInvalidDateRange ? (
              <p className="export-filter-error" role="alert">종료일은 시작일과 같거나 이후여야 합니다.</p>
            ) : null}
          </div>

          <footer>
            <span>날짜는 시작일과 종료일을 포함합니다.</span>
            <ExportDownloadButton
              disabled={hasInvalidDateRange}
              fallbackFileName="입출고-이력.xlsx"
              label="입출고 이력 개별 엑셀"
              query={{
                report: "movements",
                q: movementQ,
                from: movementFrom,
                to: movementTo,
                type: movementType
              }}
            />
          </footer>
        </article>
      </div>

      <section aria-labelledby="combined-export-heading" className="export-combined-panel">
        <div>
          <span>선택 자료 통합</span>
          <h2 id="combined-export-heading">하나의 엑셀 파일로 받기</h2>
          <p>위에서 포함을 선택한 자료와 각 카드의 필터 조건을 한 번에 적용합니다.</p>
          <div aria-live="polite" className="export-selection-summary">
            {includeInventory ? <span>재고 현황</span> : null}
            {includeMovements ? <span>입출고 이력</span> : null}
            {selectedDatasets.length === 0 ? <em>포함할 자료를 하나 이상 선택하세요.</em> : null}
          </div>
        </div>
        <ExportDownloadButton
          className="primary-button"
          disabled={combinedDisabled}
          fallbackFileName="자료-통합-내보내기.xlsx"
          label="선택 자료 통합 엑셀"
          query={{
            report: "combined",
            datasets: selectedDatasets.join(","),
            inventoryQ: includeInventory ? inventoryQ : undefined,
            inventoryStatus: includeInventory ? inventoryStatus : undefined,
            movementQ: includeMovements ? movementQ : undefined,
            from: includeMovements ? movementFrom : undefined,
            to: includeMovements ? movementTo : undefined,
            type: includeMovements ? movementType : undefined
          }}
        />
      </section>
    </div>
  );
}
