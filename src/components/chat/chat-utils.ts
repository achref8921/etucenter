import type { ChatRole, ChatUser } from "@/types/chat";

export const ROLE_LABELS: Record<ChatRole, string> = {
  admin: "Administration",
  prof: "Professeur",
  eleve: "Élève",
};

export const ROLE_PLURALS: Record<ChatRole, string> = {
  admin: "Administration",
  prof: "Professeurs",
  eleve: "Élèves",
};

export const ROLE_ORDER: ChatRole[] = ["prof", "admin", "eleve"];

export function fullName(user: Pick<ChatUser, "prenom" | "nom"> | null | undefined): string {
  if (!user) return "";
  return `${user.prenom || ""} ${user.nom || ""}`.trim();
}

export function initialsOf(user: Pick<ChatUser, "prenom" | "nom"> | null | undefined): string {
  if (!user) return "?";
  const first = (user.prenom || "").trim().charAt(0);
  const last = (user.nom || "").trim().charAt(0);
  return (first + last).toUpperCase() || "?";
}

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const time = new Date(lastSeenAt).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time < 2 * 60 * 1000;
}

export function lastSeenLabel(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Hors ligne";
  if (isOnline(lastSeenAt)) return "En ligne";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(diff) || diff < 0) return "Hors ligne";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Vu il y a ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vu il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Vu hier";
  if (days < 7) return `Vu il y a ${days} j`;
  return `Vu le ${new Date(lastSeenAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isSameDay(first: string | Date, second: string | Date): boolean {
  const a = first instanceof Date ? first : new Date(first);
  const b = second instanceof Date ? second : new Date(second);
  return startOfDay(a) === startOfDay(b);
}

export function formatMessageTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatListTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return formatMessageTime(date);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Hier";

  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDayLabel(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return "Aujourd'hui";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Hier";

  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "long" });
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function previewText(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  return singleLine.length > 90 ? `${singleLine.slice(0, 87)}…` : singleLine;
}

export function groupContactsByRole<T extends { role: ChatRole }>(contacts: T[]): {
  role: ChatRole;
  label: string;
  items: T[];
}[] {
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_PLURALS[role],
    items: contacts.filter((contact) => contact.role === role),
  })).filter((group) => group.items.length > 0);
}
