"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type NavMode = "sidebar" | "bottom";

const STORAGE_KEY = "nav-mode";

const NavModeContext = createContext<{ navMode: NavMode; setNavMode: (m: NavMode) => void }>({
  navMode: "sidebar",
  setNavMode: () => {},
});

export function NavModeProvider({ children }: { children: React.ReactNode }) {
  const [navMode, setNavModeState] = useState<NavMode>("sidebar");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "bottom" || stored === "sidebar") setNavModeState(stored);
  }, []);

  const setNavMode = (m: NavMode) => {
    setNavModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  };

  return <NavModeContext.Provider value={{ navMode, setNavMode }}>{children}</NavModeContext.Provider>;
}

export function useNavMode() {
  return useContext(NavModeContext);
}
