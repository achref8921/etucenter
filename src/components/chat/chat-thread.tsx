"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronUp,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import UserAvatar from "@/components/user-avatar";
import type {
  ChatConversationSummary,
  ChatMessage,
  ChatThread as ChatThreadData,
  ChatUser,
} from "@/types/chat";
import {
  ROLE_LABELS,
  formatDayLabel,
  formatMessageTime,
  fullName,
  isOnline,
  isSameDay,
  lastSeenLabel,
} from "./chat-utils";

interface ChatThreadProps {
  conversationId: string;
  meId: string;
  summary: ChatConversationSummary | null;
  onBack: () => void;
  onRead: (conversationId: string) => void;
  onMessageSent: (conversationId: string, message: ChatMessage) => void;
}

function makeClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function mergeWithServer(previous: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const serverIds = new Set(server.map((message) => message.id));
  const serverClientIds = new Set(
    server.map((message) => message.clientId).filter((value): value is string => Boolean(value))
  );
  const oldestServer = server.length > 0 ? server[0].createdAt : null;

  const older = oldestServer
    ? previous.filter(
        (message) =>
          !message.pending &&
          !message.failed &&
          !serverIds.has(message.id) &&
          message.createdAt < oldestServer
      )
    : [];

  const pending = previous.filter(
    (message) =>
      (message.pending || message.failed) &&
      (!message.clientId || !serverClientIds.has(message.clientId))
  );

  const byId = new Map<string, ChatMessage>();
  for (const message of [...older, ...server, ...pending]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Vrai si au moins un message entrant apporte une information nouvelle. */
function hasMessageChanges(previous: ChatMessage[], incoming: ChatMessage[]): boolean {
  const known = new Map(previous.map((message) => [message.id, message]));
  return incoming.some((message) => {
    const existing = known.get(message.id);
    if (!existing) return true;
    return existing.readAt !== message.readAt || existing.content !== message.content;
  });
}

export default function ChatThread({
  conversationId,
  meId,
  summary,
  onBack,
  onRead,
  onMessageSent,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<ChatThreadData["conversation"] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newIncoming, setNewIncoming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousCountRef = useRef(0);
  const skipAutoScrollRef = useRef(false);
  const lastSyncRef = useRef<string | null>(null);

  const other = meta?.other ?? summary?.other ?? null;
  const otherLastReadAt = meta?.otherLastReadAt ?? null;

  const scrollToBottom = useCallback((smooth = false) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const markRead = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages/${conversationId}/read`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        onRead(conversationId);
        window.dispatchEvent(new Event("chat:read"));
      }
    } catch {
      // Le prochain rafraîchissement réessaiera.
    }
  }, [conversationId, onRead]);

  useEffect(() => {
    let cancelled = false;

    setMessages([]);
    setMeta(null);
    setHasMore(false);
    setError(null);
    setDraft("");
    setNewIncoming(false);
    setLoading(true);
    previousCountRef.current = 0;
    lastSyncRef.current = null;

    (async () => {
      try {
        const response = await fetch(`/api/messages/${conversationId}?take=30`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setError(data?.error || "Impossible de charger la conversation.");
          setLoading(false);
          return;
        }

        const initial: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        setMessages(initial);
        setMeta(data.conversation ?? null);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);
        lastSyncRef.current = initial.length
          ? initial[initial.length - 1].createdAt
          : new Date().toISOString();
        requestAnimationFrame(() => scrollToBottom(false));
        void markRead();
      } catch {
        if (!cancelled) {
          setError("Connexion impossible. Vérifiez votre réseau.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, markRead, scrollToBottom]);

  useEffect(() => {
    if (loading) return;

    let stopped = false;
    let running = false;

    const applyConversation = (
      patch: Partial<Omit<ChatThreadData["conversation"], "other">> & {
        id: string;
        other?: ChatUser | null;
      }
    ) => {
      setMeta((previous) => {
        if (!previous) {
          if (!patch.other || !patch.lastMessageAt) return previous;
          return { ...patch, other: patch.other } as ChatThreadData["conversation"];
        }
        const next: ChatThreadData["conversation"] = {
          ...previous,
          ...patch,
          other: patch.other ?? previous.other,
        };
        // Évite un rendu inutile toutes les 4 s quand rien n'a bougé.
        if (
          next.lastMessageAt === previous.lastMessageAt &&
          next.myLastReadAt === previous.myLastReadAt &&
          next.otherLastReadAt === previous.otherLastReadAt &&
          next.other?.id === previous.other?.id &&
          next.other?.lastSeenAt === previous.other?.lastSeenAt &&
          next.other?.image === previous.other?.image
        ) {
          return previous;
        }
        return next;
      });
    };

    const fullSync = async () => {
      const response = await fetch(`/api/messages/${conversationId}?take=50`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      if (stopped) return;

      if (data.conversation) applyConversation(data.conversation);
      const server: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
      setMessages((previous) =>
        hasMessageChanges(previous, server) ? mergeWithServer(previous, server) : previous
      );
      lastSyncRef.current = server.length
        ? server[server.length - 1].createdAt
        : new Date().toISOString();
      if (server.some((message) => message.senderId !== meId && !message.readAt)) void markRead();
    };

    const tick = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const after = lastSyncRef.current;
        const url = after
          ? `/api/messages/${conversationId}?after=${encodeURIComponent(after)}`
          : `/api/messages/${conversationId}?take=50`;

        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        if (stopped) return;

        if (data.reset) {
          await fullSync();
          return;
        }

        if (data.conversation) applyConversation(data.conversation);

        const incoming: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (incoming.length === 0) return;

        lastSyncRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((previous) =>
          hasMessageChanges(previous, incoming) ? mergeWithServer(previous, incoming) : previous
        );

        if (incoming.some((message) => message.senderId !== meId && !message.readAt)) {
          void markRead();
        }
      } catch {
        // Silencieux : le prochain passage réessaiera.
      } finally {
        running = false;
      }
    };

    const interval = window.setInterval(tick, 4000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [conversationId, loading, markRead, meId]);

  useEffect(() => {
    if (loading) return;
    const element = scrollRef.current;
    if (!element) return;

    const last = messages[messages.length - 1];
    const grew = messages.length > previousCountRef.current;
    previousCountRef.current = messages.length;

    if (!grew || !last) return;

    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }

    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 180;
    if (nearBottom || last.senderId === meId || last.pending) {
      requestAnimationFrame(() =>
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" })
      );
      setNewIncoming(false);
    } else if (last.senderId !== meId) {
      setNewIncoming(true);
    }
  }, [messages, loading, meId]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
  }, [draft]);

  const loadOlder = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const before = messages[0].createdAt;
    const element = scrollRef.current;
    const previousHeight = element?.scrollHeight ?? 0;

    try {
      const response = await fetch(
        `/api/messages/${conversationId}?take=30&before=${encodeURIComponent(before)}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      skipAutoScrollRef.current = true;
      setMessages((previous) => {
        const known = new Set(previous.map((message) => message.id));
        const older = (Array.isArray(data.messages) ? data.messages : []).filter(
          (message: ChatMessage) => !known.has(message.id)
        );
        return [...older, ...previous].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
      setHasMore(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        if (element) element.scrollTop = element.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const postMessage = useCallback(
    async (text: string, clientId: string, temporaryId: string) => {
      setSending(true);
      setError(null);
      try {
        const response = await fetch(`/api/messages/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ content: text, clientId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Impossible d'envoyer le message.");
        }
        setMessages((previous) =>
          previous.map((message) =>
            message.id === temporaryId || message.clientId === clientId ? data.message : message
          )
        );
        const sentAt = data.message?.createdAt;
        if (sentAt && (!lastSyncRef.current || sentAt > lastSyncRef.current)) {
          lastSyncRef.current = sentAt;
        }
        onMessageSent(conversationId, data.message);
      } catch (sendError) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === temporaryId || message.clientId === clientId
              ? { ...message, pending: false, failed: true }
              : message
          )
        );
        setError(sendError instanceof Error ? sendError.message : "Impossible d'envoyer le message.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, onMessageSent]
  );

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sending) return;

    const clientId = makeClientId();
    const temporaryId = `temp_${clientId}`;
    const optimistic: ChatMessage = {
      id: temporaryId,
      conversationId,
      senderId: meId,
      content: text,
      clientId,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
    };

    setMessages((previous) => [...previous, optimistic]);
    setDraft("");
    setNewIncoming(false);
    requestAnimationFrame(() => scrollToBottom(true));
    void postMessage(text, clientId, temporaryId);
  };

  const retry = (message: ChatMessage) => {
    if (!message.clientId || sending) return;
    setMessages((previous) =>
      previous.map((item) =>
        item.id === message.id ? { ...item, pending: true, failed: false } : item
      )
    );
    void postMessage(message.content, message.clientId, message.id);
  };

  const rows = useMemo(
    () =>
      messages.map((message, index) => {
        const previous = messages[index - 1];
        return {
          message,
          showDay: !previous || !isSameDay(previous.createdAt, message.createdAt),
        };
      }),
    [messages]
  );

  const isMessageRead = (message: ChatMessage) => {
    if (message.readAt) return true;
    if (otherLastReadAt && message.createdAt <= otherLastReadAt) return true;
    return false;
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <header className="flex h-[62px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface)]/95 px-3 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour aux conversations"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-muted)] md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {other ? (
          <>
            <div className="relative shrink-0">
              <UserAvatar
                userId={other.id}
                nom={other.nom}
                prenom={other.prenom}
                hasImage={Boolean(other.image)}
                size="sm"
              />
              {isOnline(other.lastSeenAt) && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-tight text-[var(--foreground)]">
                {fullName(other)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[var(--foreground-faint)]">
                <span>{ROLE_LABELS[other.role]}</span>
                <span aria-hidden="true">·</span>
                <span className={isOnline(other.lastSeenAt) ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}>
                  {lastSeenLabel(other.lastSeenAt)}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="h-10 flex-1 animate-pulse rounded bg-[var(--surface-muted)]" />
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[var(--surface-muted)] px-3 py-3 sm:px-5"
        role="log"
        aria-live="polite"
        aria-label="Messages de la conversation"
      >
        {hasMore && !loading && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingMore}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground-subtle)] shadow-xs transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
              Messages précédents
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-7 w-7 text-red-500" />
            <p className="max-w-xs text-[13px] text-[var(--foreground-subtle)]">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--primary)] shadow-xs">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[var(--foreground)]">
                Démarrez la conversation
              </p>
              <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--foreground-faint)]">
                Envoyez un premier message à {other ? fullName(other) : "votre contact"}. Vos échanges
                restent privés au sein du centre.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-auto space-y-1">
            {rows.map(({ message, showDay }) => {
              const mine = message.senderId === meId;
              return (
                <div key={message.id}>
                  {showDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-faint)] shadow-xs">
                        {formatDayLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`group relative max-w-[82%] rounded-[18px] px-3.5 py-2 shadow-xs sm:max-w-[68%] ${
                        mine
                          ? "rounded-br-[5px] bg-[var(--primary)] text-white"
                          : "rounded-bl-[5px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                      } ${message.failed ? "ring-1 ring-red-400" : ""}`}
                    >
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.45]">
                        {message.content}
                      </p>
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-white/70" : "text-[var(--foreground-faint)]"
                        }`}
                      >
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {mine &&
                          (message.pending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : message.failed ? (
                            <button
                              type="button"
                              onClick={() => retry(message)}
                              className="flex items-center gap-0.5 rounded px-0.5 font-medium text-red-100 underline decoration-red-200/70 underline-offset-2 hover:text-white"
                              title="Réessayer l'envoi"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Réessayer
                            </button>
                          ) : isMessageRead(message) ? (
                            <CheckCheck className="h-3.5 w-3.5 text-white" aria-label="Lu" />
                          ) : (
                            <Check className="h-3.5 w-3.5" aria-label="Envoyé" />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {newIncoming && (
        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={() => {
              scrollToBottom(true);
              setNewIncoming(false);
            }}
            className="pointer-events-auto absolute -top-11 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg"
          >
            <ChevronUp className="h-3.5 w-3.5 rotate-180" />
            Nouveau message
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-2.5 py-2.5 sm:px-4">
        {error && messages.length > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Écrivez votre message…"
              aria-label="Votre message"
              className="max-h-[132px] min-h-[42px] w-full resize-none rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 pr-12 text-[13px] leading-[1.4] text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-faint)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] font-medium text-[var(--foreground-faint)]">
              {draft.length > 1800 ? `${draft.length}/2000` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Envoyer le message"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <Send className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        <p className="mt-1.5 hidden text-center text-[10px] text-[var(--foreground-faint)] sm:block">
          Entrée pour envoyer · Maj + Entrée pour un retour à la ligne
        </p>
      </div>
    </section>
  );
}
