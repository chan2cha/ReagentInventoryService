"use client";

import { DialogFrame } from "./dialog-frame";

export function RegistrationDialog({
  title,
  triggerLabel,
  children,
  dialogClassName,
  showPlus = true,
  triggerDisabled = false,
  triggerClassName = "primary-button dialog-trigger"
}: {
  title: string;
  triggerLabel: string;
  children: React.ReactNode;
  dialogClassName?: string;
  showPlus?: boolean;
  triggerDisabled?: boolean;
  triggerClassName?: string;
}) {
  return <DialogFrame
    className={dialogClassName}
    eyebrow="ADMINISTRATION"
    showPlus={showPlus}
    title={title}
    triggerDisabled={triggerDisabled}
    triggerClassName={triggerClassName}
    triggerLabel={triggerLabel}
  >
    {children}
  </DialogFrame>;
}
