"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

const STORAGE_KEY = "educenter_uid";

export default function SessionGuard() {
  const { data: session, status } = useSession();
  const lockedRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const uid = (session.user as any).id as string;
    if (!initializedRef.current) {
      lockedRef.current = uid;
      initializedRef.current = true;
      try { sessionStorage.setItem(STORAGE_KEY, uid); } catch {}
      return;
    }
    if (lockedRef.current && uid !== lockedRef.current) {
      setMessage("Un autre compte a été ouvert dans un autre onglet de ce navigateur.");
      setConflict(true);
    }
  }, [session, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        const freshId = data?.user?.id;
        if (freshId && lockedRef.current && freshId !== lockedRef.current) {
          setMessage("Un autre compte a été ouvert dans un autre onglet de ce navigateur.");
          setConflict(true);
        } else if (!freshId && lockedRef.current) {
          setMessage("Vous avez été déconnecté(e) dans un autre onglet. La session est partagée entre tous les onglets.");
          setConflict(true);
        }
      } catch {}
    };
    const onFocus = () => check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const interval = setInterval(check, 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
    };
  }, [status]);

  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div dir="ltr" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Session partagée entre tous les onglets du navigateur
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Il est impossible d&apos;ouvrir deux comptes différents dans le même navigateur en même temps. Pour utiliser
          deux comptes, ouvrez le second dans une fenêtre de navigation privée ou dans un autre navigateur (par exemple
          Firefox ou Chrome avec un profil séparé).
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Se connecter avec le nouveau compte
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
