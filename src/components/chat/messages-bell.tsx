"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useChatUnread } from "@/components/chat/chat-unread-provider";

export default function MessagesBell({ role }: { role: string }) {
  const { totalUnread } = useChatUnread();

  if (role !== "admin" && role !== "prof" && role !== "eleve") return null;

  return (
    <Link
      href="/messages"
      prefetch={false}
      aria-label={
        totalUnread > 0 ? `Messages, ${totalUnread} non lus` : "Messages"
      }
      title="Messages"
      className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
    >
      <MessageCircle className="h-5 w-5" />
      {totalUnread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0f1114]">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  );
}
