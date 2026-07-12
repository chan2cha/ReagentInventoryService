"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";

type ExportDownloadButtonProps = {
  className?: string;
  disabled?: boolean;
  fallbackFileName: string;
  label: string;
  pendingLabel?: string;
  query: Readonly<Record<string, string | null | undefined>>;
};

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildExportUrl(query: ExportDownloadButtonProps["query"]) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value.trim()) {
      searchParams.set(key, value);
    }
  }

  return `/api/exports?${searchParams.toString()}`;
}

function safeFileName(value: string, fallback: string) {
  const normalized = value
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/^\.+/, "")
    .trim();

  return normalized || fallback;
}

export function contentDispositionFileName(header: string | null, fallback: string) {
  if (!header) return fallback;

  const extendedMatch = header.match(/filename\*\s*=\s*([^;]+)/i);

  if (extendedMatch) {
    const extendedValue = extendedMatch[1].trim().replace(/^"|"$/g, "");
    const encodedName = extendedValue.replace(/^[^']*'[^']*'/, "");

    try {
      return safeFileName(decodeURIComponent(encodedName), fallback);
    } catch {
      // Fall through to the plain filename parameter when percent-decoding fails.
    }
  }

  const plainMatch = header.match(/filename\s*=\s*(?:"((?:\\.|[^"])*)"|([^;]+))/i);
  const plainName = plainMatch?.[1]?.replace(/\\([\\"])/g, "$1") ?? plainMatch?.[2]?.trim();

  return plainName ? safeFileName(plainName, fallback) : fallback;
}

async function responseErrorMessage(response: Response) {
  const fallback = `엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도하세요. (${response.status})`;
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await response.json() as { error?: unknown; message?: unknown };
      const message = typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : null;

      return message?.trim() || fallback;
    }

    const text = (await response.text()).trim();
    return text && !text.startsWith("<") ? text : fallback;
  } catch {
    return fallback;
  }
}

export function ExportDownloadButton({
  className = "secondary-button",
  disabled = false,
  fallbackFileName,
  label,
  pendingLabel = "엑셀 준비 중...",
  query
}: ExportDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();

  async function download() {
    if (disabled || isDownloading) return;

    setError("");
    setIsDownloading(true);

    try {
      const response = await fetch(buildExportUrl(query), {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: EXCEL_MIME_TYPE }
      });

      if (!response.ok) {
        throw new Error(await responseErrorMessage(response));
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes(EXCEL_MIME_TYPE)) {
        throw new Error("서버가 올바른 엑셀 파일을 반환하지 않았습니다. 잠시 후 다시 시도하세요.");
      }

      const file = await response.blob();
      const fileName = contentDispositionFileName(
        response.headers.get("content-disposition"),
        fallbackFileName
      );
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
    } catch (caught) {
      setError(caught instanceof Error && caught.message
        ? caught.message
        : "엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="export-download-control">
      <button
        aria-describedby={error ? errorId : undefined}
        className={`${className} export-download-button`}
        disabled={disabled || isDownloading}
        onClick={download}
        type="button"
      >
        {isDownloading ? (
          <LoaderCircle aria-hidden="true" className="export-download-spinner" size={16} />
        ) : (
          <Download aria-hidden="true" size={16} />
        )}
        <span>{isDownloading ? pendingLabel : label}</span>
      </button>
      {error ? <p className="export-download-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
