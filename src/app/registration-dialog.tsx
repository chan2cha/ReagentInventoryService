"use client";

import { DialogFrame } from "./dialog-frame";

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
  return <DialogFrame
    className={dialogClassName}
    eyebrow="ADMINISTRATION"
    showPlus={showPlus}
    title={title}
    triggerClassName={triggerClassName}
    triggerLabel={triggerLabel}
  >
    {children}
  </DialogFrame>;
}
