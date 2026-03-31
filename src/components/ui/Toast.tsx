"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — bottom-right, stacked */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  const base =
    "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-md text-sm max-w-[360px] w-full animate-slide-in";

  const styles: Record<ToastType, string> = {
    success: `${base} bg-white border-zinc-200 text-zinc-800`,
    error:   `${base} bg-white border-zinc-200 text-zinc-800`,
    info:    `${base} bg-zinc-900 border-zinc-800 text-white`,
  };

  const iconWrappers: Record<ToastType, string> = {
    success: "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100",
    error:   "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100",
    info:    "flex h-5 w-5 flex-shrink-0 items-center justify-center",
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: (
      <div className={iconWrappers.success}>
        <svg className="h-3 w-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className={iconWrappers.error}>
        <svg className="h-3 w-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    info: (
      <div className={iconWrappers.info}>
        <svg className="h-4 w-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  const closeCls =
    toast.type === "info"
      ? "ml-auto flex-shrink-0 text-zinc-400 transition-colors hover:text-zinc-200"
      : "ml-auto flex-shrink-0 text-zinc-300 transition-colors hover:text-zinc-500";

  return (
    <div className={styles[toast.type]}>
      {icons[toast.type]}
      <span className="flex-1 leading-5 font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className={closeCls}
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
