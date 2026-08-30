"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck, UserPlus, GraduationCap, DollarSign, Trash2, Clock, Calendar, CalendarX, UserX } from "lucide-react";

interface Notification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

export default function NotificationBellDropdown({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setNonLues(data.nonLues);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setMarkingId(id);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
      setNonLues((prev) => Math.max(0, prev - 1));
    } catch {} finally {
      setMarkingId(null);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      const wasUnread = notifications.find((n) => n.id === id && !n.lu);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setNonLues((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toutMarquer: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
      setNonLues(0);
    } catch {}
  };

  const clearAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Supprimer toutes les notifications ?")) return;
    try {
      setClearingAll(true);
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
      setNonLues(0);
    } catch {} finally {
      setClearingAll(false);
    }
  };

  const typeIcon = (type: string) => {
    if (type === "inscription_eleve") return <GraduationCap className="h-4 w-4 text-blue-500" />;
    if (type === "inscription_prof") return <UserPlus className="h-4 w-4 text-purple-500" />;
    if (type === "ajout_eleve_prof") return <UserPlus className="h-4 w-4 text-teal-600" />;
    if (type === "modification_paiement") return <DollarSign className="h-4 w-4 text-orange-500" />;
    if (type === "paiement_recu") return <DollarSign className="h-4 w-4 text-green-500" />;
    if (type === "paiement_eleve") return <DollarSign className="h-4 w-4 text-green-500" />;
    if (type === "nouvelle_seance") return <Calendar className="h-4 w-4 text-violet-500" />;
    if (type === "seance_supprimee") return <CalendarX className="h-4 w-4 text-red-500" />;
    if (type === "absence") return <UserX className="h-4 w-4 text-orange-500" />;
    if (type === "subscription_expiring") return <Clock className="h-4 w-4 text-amber-500" />;
    if (type === "message_admin") return <Bell className="h-4 w-4 text-blue-500" />;
    return <Bell className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
  };

  if (role !== "admin" && role !== "prof" && role !== "eleve") return null;

  const allLink =
    role === "eleve"
      ? "/eleve/notifications"
      : role === "prof"
        ? "/prof/notifications"
        : "/admin/notifications";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-[#2a2d35] dark:hover:text-slate-300"
      >
        <Bell className="h-5 w-5" />
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-14 right-3 left-3 z-40 flex max-h-[calc(100dvh-4rem)] w-auto flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:right-4 sm:left-auto sm:w-96 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[#2a2d35]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notifications
              {nonLues > 0 && (
                <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {nonLues}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {nonLues > 0 && (
                <button onClick={markAllAsRead} className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400">
                  <CheckCheck className="h-3 w-3" /> Tout lire
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={clearingAll}
                  className="flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> {clearingAll ? "..." : "Tout supprimer"}
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 min-h-0 flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Aucune notification
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => markAsRead(n.id, e)}
                  className={`group flex items-start gap-3 border-b border-gray-50 px-4 py-3 transition-colors last:border-0 dark:border-[#2a2d35] ${
                    n.lu ? "bg-white dark:bg-[#181b22]" : "cursor-pointer bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{typeIcon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold ${n.lu ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                        {n.titre}
                      </p>
                      {!n.lu && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />}
                    </div>
                    <p className={`mt-0.5 text-xs leading-relaxed ${n.lu ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"}`}>
                      {n.message.length > 80 ? n.message.slice(0, 80) + "..." : n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => deleteNotification(n.id, e)}
                    className="flex-shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <Link
            href={allLink}
            onClick={() => setOpen(false)}
            className="block shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-center text-xs font-medium text-blue-600 hover:bg-gray-100 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-blue-400 dark:hover:bg-[#2a2d35]"
          >
            Voir toutes les notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
