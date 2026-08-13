"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2, UserPlus, GraduationCap, DollarSign, Clock, Calendar } from "lucide-react";

interface Notification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

function typeIcon(type: string) {
  if (type === "inscription_eleve") return <GraduationCap className="h-5 w-5 text-blue-500" />;
  if (type === "inscription_prof") return <UserPlus className="h-5 w-5 text-purple-500" />;
  if (type === "modification_paiement") return <DollarSign className="h-5 w-5 text-orange-500" />;
  if (type === "paiement_recu") return <DollarSign className="h-5 w-5 text-green-500" />;
  if (type === "paiement_eleve") return <DollarSign className="h-5 w-5 text-green-500" />;
  if (type === "nouvelle_seance") return <Calendar className="h-5 w-5 text-violet-500" />;
  if (type === "subscription_expiring") return <Clock className="h-5 w-5 text-amber-500" />;
  if (type === "message_admin") return <Bell className="h-5 w-5 text-blue-500" />;
  return <Bell className="h-5 w-5 text-gray-400 dark:text-slate-500" />;
}

export default function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setNotifications(data.notifications);
      setNonLues(data.nonLues);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      setMarkingId(id);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
      setNonLues((prev) => Math.max(0, prev - 1));
    } catch {
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toutMarquer: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
      setNonLues(0);
    } catch {
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          {nonLues > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {nonLues}
            </span>
          )}
        </div>
        {nonLues > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-800"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Bell className="mx-auto h-12 w-12 text-gray-300 dark:text-slate-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.lu && markAsRead(n.id)}
              className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                n.lu
                  ? "border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900"
                  : "cursor-pointer border-blue-100 bg-blue-50 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">{typeIcon(n.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${n.lu ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {n.titre}
                  </h3>
                  {!n.lu && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                </div>
                <p className={`mt-1 text-sm ${n.lu ? "text-gray-400 dark:text-slate-500" : "text-gray-600 dark:text-gray-400"}`}>
                  {n.message}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.lu && markingId === n.id && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-slate-500" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
