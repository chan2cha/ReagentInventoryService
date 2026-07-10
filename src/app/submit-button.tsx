"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  disabled?: boolean;
  form?: string;
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  className,
  confirmMessage,
  disabled = false,
  form,
  pendingLabel = "처리 중..."
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={disabled || pending}
      form={form}
      onClick={(event) => {
        const targetForm = event.currentTarget.form;
        if (confirmMessage && (!targetForm || targetForm.checkValidity()) && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
