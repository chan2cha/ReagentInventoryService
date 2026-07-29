"use client";

import { AlertTriangle, CircleAlert } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

type DialogTone = "default" | "danger";

type DialogOptions = {
  confirmLabel?: string;
  message: string;
  title?: string;
  tone?: DialogTone;
};

type DialogRequest = DialogOptions & {
  kind: "alert" | "confirm";
  resolve: (confirmed: boolean) => void;
};

type ConfirmationDialogApi = {
  alert: (options: string | DialogOptions) => Promise<void>;
  confirm: (options: string | DialogOptions) => Promise<boolean>;
};

const unavailableApi: ConfirmationDialogApi = {
  alert: async () => undefined,
  confirm: async () => false
};

const ConfirmationDialogContext = createContext<ConfirmationDialogApi>(unavailableApi);

function normalizeOptions(options: string | DialogOptions) {
  return typeof options === "string" ? { message: options } : options;
}

export function useConfirmationDialog() {
  return useContext(ConfirmationDialogContext);
}

export function ConfirmationDialogProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<DialogRequest | null>(null);
  const [request, setRequest] = useState<DialogRequest | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (request && !dialog.open) {
      dialog.showModal();
    }
    if (!request && dialog.open) {
      dialog.close();
    }
  }, [request]);

  const open = useCallback((kind: DialogRequest["kind"], options: string | DialogOptions) => (
    new Promise<boolean>((resolve) => {
      const nextRequest: DialogRequest = {
        ...normalizeOptions(options),
        kind,
        resolve
      };
      requestRef.current = nextRequest;
      setRequest(nextRequest);
    })
  ), []);

  const settle = useCallback((confirmed: boolean) => {
    const currentRequest = requestRef.current;
    requestRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    setRequest(null);
    currentRequest?.resolve(confirmed);
  }, []);

  const api: ConfirmationDialogApi = {
    alert: async (options) => {
      await open("alert", options);
    },
    confirm: (options) => open("confirm", options)
  };

  const isDanger = request?.tone === "danger";

  return (
    <ConfirmationDialogContext.Provider value={api}>
      {children}
      <dialog
        aria-describedby="confirmation-dialog-message"
        aria-labelledby="confirmation-dialog-title"
        className="confirmation-dialog"
        onCancel={(event) => {
          event.preventDefault();
          settle(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) settle(false);
        }}
        ref={dialogRef}
      >
        {request ? (
          <div className="confirmation-dialog-content">
            <div className={`confirmation-dialog-icon${isDanger ? " danger" : ""}`}>
              {request.kind === "alert" || isDanger
                ? <AlertTriangle aria-hidden="true" size={20} />
                : <CircleAlert aria-hidden="true" size={20} />}
            </div>
            <div>
              <h2 id="confirmation-dialog-title">
                {request.title ?? (request.kind === "alert" ? "확인이 필요합니다" : "작업을 진행할까요?")}
              </h2>
              <p id="confirmation-dialog-message">{request.message}</p>
            </div>
            <div className="confirmation-dialog-actions">
              {request.kind === "confirm" ? (
                <button autoFocus className="secondary-button" onClick={() => settle(false)} type="button">취소</button>
              ) : null}
              <button
                autoFocus={request.kind === "alert"}
                className={isDanger ? "primary-button danger" : "primary-button"}
                onClick={() => settle(true)}
                type="button"
              >
                {request.kind === "alert" ? "확인" : request.confirmLabel ?? "진행"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </ConfirmationDialogContext.Provider>
  );
}
