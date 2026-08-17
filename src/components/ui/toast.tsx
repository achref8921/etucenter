"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { bar: string; icon: React.ReactNode }> = {
  success: {
    bar: "border-green-300 dark:border-green-800",
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500 dark:text-green-400" />,
  },
  error: {
    bar: "border-red-300 dark:border-red-800",
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />,
  },
  info: {
    bar: "border-blue-300 dark:border-blue-800",
    icon: <Info className="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-4), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 3800);
    },
    [dismiss]
  );

  const toast = useCallback((kind: ToastKind, message: string) => push(kind, message), [push]);
  const success = useCallback((message: string) => push("success", message), [push]);
  const error = useCallback((message: string) => push("error", message), [push]);
  const info = useCallback((message: string) => push("info", message), [push]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const style = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-3.5 shadow-lg dark:bg-[#181b22] ${style.bar}`}
            >
              {style.icon}
              <p className="flex-1 text-sm text-gray-800 dark:text-gray-200">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-500 dark:hover:bg-[#181b22] dark:hover:text-slate-300"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}
