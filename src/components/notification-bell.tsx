"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export default function NotificationBell() {
  const [nonLues, setNonLues] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNonLues(data.nonLues);
        }
      } catch {
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/admin/notifications"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#181b22]"
    >
      <div className="relative">
        <Bell className="h-5 w-5" />
        {nonLues > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </div>
      Notifications
    </Link>
  );
}
