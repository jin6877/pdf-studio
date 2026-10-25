import { useEffect } from "react";

export type ToastKind = "info" | "success" | "error";
export interface ToastMsg {
  id: number;
  kind: ToastKind;
  text: string;
}

const styles: Record<ToastKind, string> = {
  info: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
};

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMsg; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const ms = toast.kind === "error" ? 5000 : 3000;
    const t = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      className={`pointer-events-auto animate-pop max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl ${styles[toast.kind]}`}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.text}
    </div>
  );
}
