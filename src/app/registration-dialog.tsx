"use client";

import { Plus, X } from "lucide-react";
import { useRef } from "react";

export function RegistrationDialog({ title, triggerLabel, children }: { title: string; triggerLabel: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return <><button className="primary-button dialog-trigger" onClick={() => ref.current?.showModal()} type="button"><Plus aria-hidden="true" size={17} />{triggerLabel}</button><dialog className="registration-dialog" onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }} ref={ref}><header><div><p className="eyebrow">ADMINISTRATION</p><h2>{title}</h2></div><button aria-label="닫기" className="dialog-close" onClick={() => ref.current?.close()} type="button"><X size={19} /></button></header>{children}</dialog></>;
}
