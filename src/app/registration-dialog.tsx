"use client";

import { Plus, X } from "lucide-react";
import { useRef } from "react";

export function RegistrationDialog({
  title,
  triggerLabel,
  children,
  dialogClassName,
  showPlus = true,
  triggerClassName = "primary-button dialog-trigger"
}: {
  title: string;
  triggerLabel: string;
  children: React.ReactNode;
  dialogClassName?: string;
  showPlus?: boolean;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return <><button className={triggerClassName} onClick={() => ref.current?.showModal()} type="button">{showPlus ? <Plus aria-hidden="true" size={17} /> : null}{triggerLabel}</button><dialog className={["registration-dialog", dialogClassName].filter(Boolean).join(" ")} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }} ref={ref}><header><div><p className="eyebrow">ADMINISTRATION</p><h2>{title}</h2></div><button aria-label="닫기" className="dialog-close" onClick={() => ref.current?.close()} type="button"><X size={19} /></button></header>{children}</dialog></>;
}
