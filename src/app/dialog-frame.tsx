"use client";

/** 등록·조정 대화상자의 열기, 닫기, 포커스 복귀 동작을 공통으로 제공한다. */

import { Plus, X } from "lucide-react";
import { useCallback, useRef } from "react";

type DialogFrameProps = {
  children: React.ReactNode;
  className?: string;
  eyebrow: string;
  subtitle?: React.ReactNode;
  title: string;
  showPlus?: boolean;
  triggerDisabled?: boolean;
  triggerClassName?: string;
  triggerLabel: string;
};

export function DialogFrame({
  children,
  className,
  eyebrow,
  showPlus = true,
  subtitle,
  title,
  triggerDisabled = false,
  triggerClassName = "primary-button dialog-trigger",
  triggerLabel
}: DialogFrameProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = useCallback(() => ref.current?.showModal(), []);
  const close = useCallback(() => ref.current?.close(), []);

  return <>
    <button className={triggerClassName} disabled={triggerDisabled} onClick={open} type="button">
      {showPlus ? <Plus aria-hidden="true" size={17} /> : null}{triggerLabel}
    </button>
    <dialog
      className={["registration-dialog", className].filter(Boolean).join(" ")}
      onClick={(event) => {
        const target = event.target;
        if (target === event.currentTarget || (target instanceof Element && target.closest("[data-dialog-close]"))) {
          close();
        }
      }}
      ref={ref}
    >
      <header>
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{subtitle}</div>
        <button aria-label="닫기" className="dialog-close" onClick={close} type="button"><X size={19} /></button>
      </header>
      {children}
    </dialog>
  </>;
}
