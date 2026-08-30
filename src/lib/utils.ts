import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-TN", {
    style: "decimal",
    minimumFractionDigits: 2,
  }).format(amount) + " DT";
}

export function formatTime(time: Date | string | null): string {
  if (!time) return "";
  const d = new Date(time);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function canModifyAttendance(
  seanceDate: Date | string,
  _heureDebut?: Date | string | null,
  _heureFin?: Date | string | null,
  now: Date = new Date()
): boolean {
  const dateStr = typeof seanceDate === "string" ? seanceDate.split("T")[0] : seanceDate.toISOString().split("T")[0];

  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);

  // Attendance can be recorded/modified from the seance day until 7 days after it.
  const windowEnd = new Date(dayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  return now >= dayStart && now <= windowEnd;
}

export function clientNowFromOffset(offsetMinutes?: number | null): Date {
  const offset =
    typeof offsetMinutes === "number" && Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  return new Date(Date.now() - offset * 60 * 1000);
}

export function generateRandomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function generateProfCode(): string {
  return "P" + Math.floor(1000 + Math.random() * 9000).toString();
}

export function generateCenterCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateInitialPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const length = 8;
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function sanitizeImageValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}
