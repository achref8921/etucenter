import { Suspense } from "react";
import MessagesClient from "@/components/chat/messages-client";

export const metadata = {
  title: "Messages - Étudnet",
  description: "Messagerie privée entre les élèves, les professeurs et l'administration du centre.",
};

function MessagesFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
        <p className="text-[12px] text-[var(--foreground-faint)]">Chargement des messages…</p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesFallback />}>
      <MessagesClient />
    </Suspense>
  );
}
