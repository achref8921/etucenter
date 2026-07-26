type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

const queue: LogEntry[] = [];
let processing = false;

function formatEntry(entry: LogEntry): string {
  let ctx = "";
  if (entry.context) {
    try {
      ctx = " " + JSON.stringify(entry.context, (_key, val) => (val instanceof Error ? { message: val.message, name: val.name } : val));
    } catch {
      ctx = " [unserializable context]";
    }
  }
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${ctx}`;
}

async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;
  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (entry.level === "error") {
      console.error(formatEntry(entry));
    } else if (entry.level === "warn") {
      console.warn(formatEntry(entry));
    } else {
      console.log(formatEntry(entry));
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  processing = false;
}

function enqueue(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  queue.push({
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  });
  if (!processing) {
    void processQueue();
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => enqueue("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => enqueue("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => enqueue("error", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => enqueue("debug", msg, ctx),
};
