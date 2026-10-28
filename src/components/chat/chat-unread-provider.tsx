"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface ChatUnreadContextValue {
  totalUnread: number;
  refresh: () => Promise<void>;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({
  totalUnread: 0,
  refresh: async () => {},
});

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const [totalUnread, setTotalUnread] = useState(0);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const res = await fetch("/api/messages/unread", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      // Une réponse plus ancienne ne doit pas écraser un compteur plus récent
      // (lecture d'une conversation pendant qu'un rafraîchissement est en vol).
      if (requestId !== requestIdRef.current) return;
      setTotalUnread(Math.max(0, Number(data?.totalUnread) || 0));
    } catch {
      // Réseau indisponible : on conserve le dernier compteur connu.
    }
  }, []);

  useEffect(() => {
    void refresh();

    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  const value = useMemo(() => ({ totalUnread, refresh }), [totalUnread, refresh]);

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread(): ChatUnreadContextValue {
  return useContext(ChatUnreadContext);
}
