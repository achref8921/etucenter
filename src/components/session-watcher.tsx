"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

const STORAGE_KEY = "educenter_session_user";

export default function SessionWatcher() {
  const { data: session, status } = useSession();
  const [changed, setChanged] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const initialUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const currentUserId = (session?.user as any)?.id as string | undefined;
  const currentRole = (session?.user as any)?.role as string | undefined;

  // On first auth, lock in this tab's intended user
  useEffect(() => {
    if (status === "authenticated" && currentUserId && !initializedRef.current) {
      initialUserIdRef.current = currentUserId;
      initializedRef.current = true;
      try { sessionStorage.setItem(STORAGE_KEY, currentUserId); } catch {}
    }
  }, [status, currentUserId]);

  // On focus / visibility change, re-fetch session and compare
  useEffect(() => {
    if (status !== "authenticated") return;

    const check = async () => {
      const locked = initialUserIdRef.current;
      if (!locked) return;
      try {
        const res = await fetch("/api/auth/session");
        const fresh = await res.json();
        const freshId = fresh?.user?.id as string | undefined;
        if (freshId && freshId !== locked) {
          setBannerText("Un autre compte a été ouvert dans un autre onglet.");
          setChanged(true);
        }
      } catch {}
    };

    const onFocus = () => check();
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(check, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [status]);

  if (!changed) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2 bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-amber-600 sm:flex-row sm:justify-center">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span>{bannerText}</span>
      <div className="flex gap-2">
        <button
          onClick={() => {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
            window.location.reload();
          }}
          className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 transition-colors"
        >
          Rafraîchir
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 transition-colors"
        >
          <LogOut className="h-3 w-3" /> Déconnecter
        </button>
      </div>
    </div>
  );
}
