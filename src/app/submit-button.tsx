"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useConfirmationDialog } from "./confirmation-dialog";

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
  const { confirm } = useConfirmationDialog();

  return (
    <button
      aria-busy={pending}
      className={["submit-button", className].filter(Boolean).join(" ")}
      disabled={disabled || pending}
      form={form}
      onClick={async (event) => {
        if (!confirmMessage) return;

        const submitter = event.currentTarget;
        const targetForm = submitter.form;
        if (targetForm && !targetForm.checkValidity()) return;

        event.preventDefault();
        const confirmed = await confirm({
          message: confirmMessage,
          tone: className?.includes("danger") ? "danger" : "default"
        });
        if (confirmed) targetForm?.requestSubmit(submitter);
      }}
      type="submit"
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="submit-button-spinner" size={16} />
      ) : null}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </button>
  );
}
