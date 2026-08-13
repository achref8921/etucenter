"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = "checking" | "supported" | "granted" | "denied" | "unsupported";

export default function PushSetup() {
  const { status } = useSession();
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);

  const ensureSw = useCallback(async () => {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing?.active) {
      existing.update().catch(() => {});
      return existing;
    }
    const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    return navigator.serviceWorker.ready;
  }, []);

  const registerSubscription = useCallback(
    async (sub: PushSubscription) => {
      try {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: sub.toJSON().keys,
          }),
        });
      } catch (e) {
        /* silencieux */
      }
    },
    []
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setState("granted");
      ensureSw()
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await registerSubscription(sub);
            return;
          }
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!publicKey) return;
          const newSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          await registerSubscription(newSub);
        })
        .catch(() => {});
    } else if (Notification.permission === "denied") {
      setState("denied");
    } else {
      setState("supported");
    }
  }, [status, ensureSw, registerSubscription]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "supported");
        return;
      }
      const reg = await ensureSw();
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await registerSubscription(sub);
      setState("granted");
    } catch (e) {
      console.error("Erreur activation push", e);
    } finally {
      setBusy(false);
    }
  };

  if (status !== "authenticated" || state === "checking" || state === "granted" || state === "unsupported") {
    return null;
  }

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md rounded-xl border border-blue-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {state === "denied" ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Notifications bloquées
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Pour les réactiver, ouvrez les paramètres de votre navigateur et autorisez les
                notifications pour ce site.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Activez les notifications
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Recevez les messages et paiements en popup même quand vous n'êtes pas connectés.
              </p>
            </>
          )}
          {state === "supported" && (
            <button
              onClick={enable}
              disabled={busy}
              className="mt-2 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Activation..." : "Activer les notifications"}
            </button>
          )}
        </div>
        <button
          onClick={() => setState("granted")}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
