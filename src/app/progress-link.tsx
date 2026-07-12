"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import styles from "./progress-link.module.css";

export function RouteProgressFeedback({ pending }: { pending: boolean }) {
  if (!pending || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <span aria-hidden="true" className={styles.track}>
        <span className={styles.bar} />
      </span>
      <span aria-live="polite" className={styles.status} role="status">
        화면을 불러오는 중입니다.
      </span>
    </>,
    document.body
  );
}

export function RouteProgressIndicator() {
  const { pending } = useLinkStatus();

  return <RouteProgressFeedback pending={pending} />;
}

export function ProgressLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <RouteProgressIndicator />
    </Link>
  );
}
