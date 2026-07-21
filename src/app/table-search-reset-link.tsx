"use client";

import type { ComponentProps, MouseEvent } from "react";
import { ProgressLink } from "./progress-link";

export function clearTableSearchControls(form: HTMLFormElement) {
  form
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="hidden"]), select'
    )
    .forEach((control) => {
      control.value = "";
    });
}

export function TableSearchResetLink({
  children,
  onClick,
  ...props
}: ComponentProps<typeof ProgressLink>) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const form = event.currentTarget.closest("form");

    if (form) {
      clearTableSearchControls(form);
    }
  };

  return (
    <ProgressLink {...props} onClick={handleClick}>
      {children}
    </ProgressLink>
  );
}
