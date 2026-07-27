"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";

export default function SessionWatcher() {
  const { data: session } = useSession();
  const [changed, setChanged] = useState(false);
  const [bannerText, setBannerText] = useState("");

  const currentUserId = (session?.user as any)?.id;
  const currentRole = (session?.user as any)?.role;

  const checkSession = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch("/api/auth/session");
      const fresh = await res.json();
      const freshId = fresh?.user?.id;
      const freshRole = fresh?.user?.role;
      if (freshId && freshId !== currentUserId) {
        setBannerText("Un autre compte a été ouvert dans un autre onglet.");
        setChanged(true);
      } else if (freshRole && freshRole !== currentRole) {
        setBannerText("Votre rôle a été modifié par un administrateur.");
        setChanged(true);
      }
    } catch {}
  }, [currentUserId, currentRole]);

  useEffect(() => {
    if (!currentUserId) return;

    const onFocus = () => checkSession();
    const onStorage = () => checkSession();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const interval = setInterval(checkSession, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [currentUserId, checkSession]);

  if (!changed) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg dark:bg-amber-600">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>{bannerText}</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 transition-colors"
      >
        Rafraîchir
      </button>
    </div>
  );
}
