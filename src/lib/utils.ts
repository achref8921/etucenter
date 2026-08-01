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

export function canModifyAttendance(
  seanceDate: Date | string,
  heureDebut: Date | string | null,
  heureFin: Date | string | null
): boolean {
  const now = new Date();

  const dateStr = typeof seanceDate === "string" ? seanceDate.split("T")[0] : seanceDate.toISOString().split("T")[0];

  let start: Date;
  if (heureDebut) {
    const timeStr = typeof heureDebut === "string" ? heureDebut : heureDebut.toISOString();
    const timePart = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    start = new Date(`${dateStr}T${timePart}`);
  } else {
    start = new Date(`${dateStr}T00:00:00`);
  }

  let end: Date;
  if (heureFin) {
    const timeStr = typeof heureFin === "string" ? heureFin : heureFin.toISOString();
    const timePart = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    end = new Date(`${dateStr}T${timePart}`);
  } else {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const deadline = new Date(end.getTime() + 30 * 60 * 1000);

  return now >= start && now <= deadline;
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
