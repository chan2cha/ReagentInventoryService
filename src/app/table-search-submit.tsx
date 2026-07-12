"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useFormStatus } from "react-dom";
import { RouteProgressFeedback } from "./progress-link";

export function TableSearchSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="table-search-submit"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className="table-search-submit-spinner"
          size={16}
        />
      ) : (
        <Search aria-hidden="true" size={16} />
      )}
      <span>{pending ? "검색 중..." : "검색"}</span>
      <RouteProgressFeedback pending={pending} />
    </button>
  );
}
