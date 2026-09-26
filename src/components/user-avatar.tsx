"use client";

import { useState } from "react";

const SIZES = {
  xs: "h-8 w-8 text-[10px]",
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
} as const;

const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
];

interface UserAvatarProps {
  userId?: string | null;
  nom?: string | null;
  prenom?: string | null;
  hasImage?: boolean | null;
  version?: string | number | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}

export default function UserAvatar({
  userId,
  nom,
  prenom,
  hasImage,
  version,
  size = "md",
  className = "",
  ring = false,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  const first = (prenom || "").trim().charAt(0);
  const last = (nom || "").trim().charAt(0);
  const initials = (first + last).toUpperCase() || (nom || "?").charAt(0).toUpperCase();

  const colorIndex = Array.from(`${prenom || ""}${nom || ""}`).reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  ) % PALETTE.length;

  const canLoad = Boolean(userId) && hasImage === true && !failed;
  const src = userId ? `/api/utilisateurs/${userId}/image${version ? `?v=${version}` : ""}` : "";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${
        SIZES[size]
      } ${ring ? "ring-2 ring-white dark:ring-slate-900" : ""} ${
        canLoad ? "bg-neutral-100 dark:bg-slate-800" : PALETTE[colorIndex]
      } ${className}`}
    >
      {canLoad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={prenom || nom || "Photo"}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
