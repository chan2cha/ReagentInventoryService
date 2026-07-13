"use client";

import { useEffect } from "react";
import type { FlashMessage as FlashMessageValue } from "@/lib/flash-message";

export function FlashMessage({ value, form = false }: {
  value: FlashMessageValue | null;
  form?: boolean;
}) {
  useEffect(() => {
    if (value) {
      void fetch("/api/flash", { method: "DELETE" });
    }
  }, [value]);

  if (!value) return null;

  const className = form
    ? `form-alert${value.kind === "success" ? " success" : ""}`
    : `page-alert${value.kind === "success" ? " success" : ""}`;

  return <div className={className}>{value.message}</div>;
}
