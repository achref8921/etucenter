"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
  chips?: string[];
}

const DEFAULT_AR = "مرحبًا 👋 تحكم في مركزك بسرعة.\nاكتب أي أمر بالعربية أو الفرنسية، مثلاً «ربح هذا الشهر» أو «من لم يسدد».";
const DEFAULT_FR = "Bonjour 👋 Gérez votre centre en un instant.\nÉcrivez une commande en arabe ou en français, ex. « bénéfice du mois » ou « qui n'a pas payé ».";

export default function AssistantWidget({ isProf }: { isProf: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, from: "bot", text: DEFAULT_FR, chips: starterChips(isProf) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { id: Date.now(), from: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        let msg = "Une erreur est survenue, réessayez.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        setMessages((m) => [...m, { id: Date.now(), from: "bot", text: msg }]);
        return;
      }
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { id: Date.now(), from: "bot", text: data.reply, chips: data.chips },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: Date.now(), from: "bot", text: "Erreur réseau. Vérifiez votre connexion." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Assistant"
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-105 dark:bg-indigo-500 md:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-36 right-3 z-50 flex h-[70vh] max-h-[520px] w-[calc(100vw-24px)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2a2d35] dark:bg-[#181b22] md:right-6">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-[#252830]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Assistant</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {isProf ? "Vos groupes & salaires" : "Votre centre — chiffres en direct"}
              </p>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[13px] leading-relaxed">
            {messages.map((m, i) =>
              m.from === "bot" ? (
                <div key={m.id || i}>
                  <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-gray-800 dark:bg-[#1f232c] dark:text-gray-200" dir="auto">
                    {m.text}
                  </div>
                  {m.chips && m.chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.chips.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => send(c)}
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white dark:bg-indigo-500">
                    {m.text}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Réfléchit…</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-[#252830]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isProf ? "Ex: mes séances de demain…" : "Ex: qui n'a pas payé ce mois…"}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:border-[#2a2d35] dark:bg-[#111318] dark:text-gray-200"
              dir="auto"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Envoyer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-opacity disabled:opacity-40 dark:bg-indigo-500"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function starterChips(isProf: boolean): string[] {
  return isProf
    ? ["حصصنا اليوم", "حصتنا المالية", "غياب مجموعتي", "تلاميذ مجموعتي"]
    : ["ربح هذا الشهر", "من لم يسدد", "نسبة الغياب", "الحصص اليوم"];
}