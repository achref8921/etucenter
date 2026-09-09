"use client";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

interface TimeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const baseClass =
  "w-full min-w-0 rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50";

export default function TimeInput({ id, value, onChange, disabled, className = "" }: TimeInputProps) {
  const [hour, minute] = (value || ":").split(":");

  const changeHour = (v: string) => {
    if (v === "") onChange("");
    else onChange(`${v}:${minute || "00"}`);
  };

  const changeMinute = (v: string) => {
    if (v === "") onChange("");
    else onChange(`${hour || "00"}:${v}`);
  };

  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      <select
        id={id}
        value={hour}
        disabled={disabled}
        onChange={(e) => changeHour(e.target.value)}
        className={baseClass}
        aria-label="Heures"
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">:</span>
      <select
        value={minute}
        disabled={disabled}
        onChange={(e) => changeMinute(e.target.value)}
        className={baseClass}
        aria-label="Minutes"
      >
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}