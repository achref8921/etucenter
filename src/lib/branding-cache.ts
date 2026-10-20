"use client";

import { useEffect, useState } from "react";

const LOGO_KEY = "branding:centerLogo";
const NAME_KEY = "branding:centerName";
const EVENT = "branding:changed";

/**
 * Petit cache du logo/nom du centre côté navigateur.
 * Le layout de tableau de bord l'alimente dès qu'il connaît le centre, ce qui
 * permet à l'écran d'attente (login / navigation) d'afficher le bon logo sans
 * avoir besoin d'une requête serveur supplémentaire.
 */
export function setCachedBranding(logo: string | null, name: string | null) {
  try {
    if (logo) localStorage.setItem(LOGO_KEY, logo);
    else localStorage.removeItem(LOGO_KEY);
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function getCachedLogo(): string | null {
  try {
    return localStorage.getItem(LOGO_KEY);
  } catch {
    return null;
  }
}

export function useCachedLogo(): string | null {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setLogo(localStorage.getItem(LOGO_KEY));
      } catch {}
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  return logo;
}
