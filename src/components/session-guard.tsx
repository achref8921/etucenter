"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "educenter_uid";

export default function SessionGuard() {
  const { data: session, status } = useSession();
  const lockedRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

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
      window.location.href = "/login?error=session_conflict";
    }
  }, [session, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        const freshId = data?.user?.id;
        if (freshId && lockedRef.current && freshId !== lockedRef.current) {
          window.location.href = "/login?error=session_conflict";
        }
      } catch {}
    };
    const onFocus = () => check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status]);

  return null;
}
