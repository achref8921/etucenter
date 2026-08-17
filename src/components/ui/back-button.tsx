"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({
  fallbackHref,
  label = "Retour",
  className = "",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-gray-300 dark:hover:bg-[#181b22] ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
