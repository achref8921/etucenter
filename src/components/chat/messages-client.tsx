"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, ArrowLeft, Search, SquarePen, Users, X } from "lucide-react";
import UserAvatar from "@/components/user-avatar";
import { useChatUnread } from "@/components/chat/chat-unread-provider";
import ChatThread from "@/components/chat/chat-thread";
import ChatDirectory from "@/components/chat/chat-directory";
import {
  ROLE_LABELS,
  formatListTime,
  fullName,
  isOnline,
  previewText,
} from "@/components/chat/chat-utils";
import { cn } from "@/lib/utils";
import type {
  ChatConversationSummary,
  ChatDirectoryUser,
  ChatMessage,
  ChatRole,
  ChatUser,
} from "@/types/chat";

/**
 * Empreinte légère d'une liste de conversations : sert à éviter de remplacer
 * l'état (et donc de re-rendre toute la liste) quand le rafraîchissement
 * automatique ne rapporte aucun changement.
 */
function conversationsSignature(list: ChatConversationSummary[]): string {
  return list
    .map(
      (conversation) =>
        `${conversation.id}:${conversation.lastMessageAt}:${conversation.unreadCount}:${
          conversation.lastMessage?.id ?? ""
        }:${conversation.lastReadAt ?? ""}:${conversation.other.lastSeenAt ?? ""}:${
          conversation.other.image ?? ""
        }`
    )
    .join("|");
}

export default function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { totalUnread, refresh: refreshUnread } = useChatUnread();

  const meId = session?.user?.id ?? "";
  const rawRole = (session?.user as { role?: string } | undefined)?.role;
  const role: ChatRole = rawRole === "admin" || rawRole === "prof" ? rawRole : "eleve";

  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("c"));
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<"discussions" | "annuaire">("discussions");
  const [directoryFocus, setDirectoryFocus] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const listSignatureRef = useRef<string | null>(null);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const response = await fetch("/api/messages", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!silent) setListError(data?.error || "Impossible de charger les conversations.");
        return;
      }
      const next: ChatConversationSummary[] = Array.isArray(data.conversations)
        ? data.conversations
        : [];
      const signature = conversationsSignature(next);
      if (signature !== listSignatureRef.current) {
        listSignatureRef.current = signature;
        setConversations(next);
      }
      setListError(null);
    } catch {
      if (!silent) setListError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void loadConversations(true);
    };
    const interval = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [loadConversations]);

  useEffect(() => {
    const target = searchParams.get("c");
    if (target) setSelectedId(target);
  }, [searchParams]);

  const selectedSummary = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const name = `${conversation.other.prenom} ${conversation.other.nom}`.toLowerCase();
      const last = (conversation.lastMessage?.content || "").toLowerCase();
      return name.includes(query) || last.includes(query);
    });
  }, [conversations, search]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      setPanel("discussions");
      setSelectedId(conversationId);
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
      void refreshUnread();
      router.replace(`/messages?c=${conversationId}`, { scroll: false });
    },
    [refreshUnread, router]
  );

  const openDirectory = useCallback(() => {
    setPickError(null);
    setPanel("annuaire");
    setDirectoryFocus((value) => value + 1);
  }, []);

  const closeThread = useCallback(() => {
    setSelectedId(null);
    router.replace("/messages", { scroll: false });
  }, [router]);

  const roleHome = role === "admin" ? "/admin" : role === "prof" ? "/prof" : "/eleve";

  /**
   * Retour d'un cran : annuaire -> discussions, conversation ouverte -> liste,
   * sinon on quitte la messagerie pour le tableau de bord du rôle.
   */
  const goBack = useCallback(() => {
    if (panel === "annuaire") {
      setPanel("discussions");
      return;
    }
    if (selectedId) {
      closeThread();
      return;
    }
    router.push(roleHome);
  }, [closeThread, panel, roleHome, router, selectedId]);

  const backLabel =
    panel === "annuaire"
      ? "Retour aux discussions"
      : selectedId
        ? "Retour à la liste des conversations"
        : "Retour au tableau de bord";

  const handleRead = useCallback(
    (conversationId: string) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
      void refreshUnread();
    },
    [refreshUnread]
  );

  const handleMessageSent = useCallback((conversationId: string, message: ChatMessage) => {
    setConversations((previous) => {
      const next = previous.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
                senderId: message.senderId,
                readAt: message.readAt,
              },
              lastMessageAt: message.createdAt,
            }
          : conversation
      );
      return next.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    });
  }, []);

  const handlePick = async (user: ChatUser) => {
    if (pickingId) return;
    setPickingId(user.id);
    setPickError(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPickError(data?.error || "Impossible de démarrer cette conversation.");
        return;
      }

      const conversation = data.conversation;
      setConversations((previous) => {
        const exists = previous.some((item) => item.id === conversation.id);
        if (exists) {
          return previous.map((item) =>
            item.id === conversation.id
              ? {
                  ...item,
                  other: conversation.other ?? item.other,
                  unreadCount: conversation.unreadCount ?? item.unreadCount,
                  lastReadAt: conversation.lastReadAt ?? item.lastReadAt,
                }
              : item
          );
        }
        return [
          {
            id: conversation.id,
            other: conversation.other,
            lastMessage: null,
            unreadCount: conversation.unreadCount ?? 0,
            lastMessageAt: conversation.lastMessageAt,
            lastReadAt: conversation.lastReadAt ?? null,
          },
          ...previous,
        ];
      });

      selectConversation(conversation.id);
    } catch {
      setPickError("Connexion impossible. Réessayez.");
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div className="h-full min-h-0 md:p-4 lg:p-5">
      <div className="flex h-full min-h-0 overflow-hidden bg-[var(--surface)] md:rounded-[var(--radius-xl)] md:border md:border-[var(--border)] md:shadow-[var(--shadow-card)] ring-1 ring-black/0 dark:ring-white/0">
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col border-[var(--border)] bg-[var(--surface)] md:w-[330px] md:border-r lg:w-[370px]",
            selectedId ? "hidden md:flex" : "flex"
          )}
        >
        <div className="relative flex h-[66px] shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/[0.09] via-[var(--surface)] to-[var(--surface)] px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={goBack}
              aria-label={backLabel}
              title={backLabel}
              className="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                Messages
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[var(--foreground-faint)]">
                {totalUnread > 0 ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
                    />
                    <span className="truncate">
                      {`${totalUnread} message${totalUnread > 1 ? "s" : ""} non lu${
                        totalUnread > 1 ? "s" : ""
                      }`}
                    </span>
                  </>
                ) : (
                  "Vos échanges privés"
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openDirectory}
            aria-label="Nouvelle conversation"
            title="Nouvelle conversation"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 text-white shadow-[var(--shadow-sm)] transition hover:brightness-110 active:scale-95"
          >
            <SquarePen className="h-[16px] w-[16px]" />
            <span className="hidden text-[12px] font-semibold sm:inline">Nouveau</span>
          </button>
        </div>

        <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
          <div
            role="tablist"
            aria-label="Sections de la messagerie"
            className="flex gap-1 rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={panel === "discussions"}
              onClick={() => setPanel("discussions")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[11.5px] font-semibold transition-colors",
                panel === "discussions"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Discussions
              {totalUnread > 0 && (
                <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === "annuaire"}
              onClick={openDirectory}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[11.5px] font-semibold transition-colors",
                panel === "annuaire"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Annuaire
            </button>
          </div>
        </div>

        {panel === "discussions" ? (
          <>

          <div className="shrink-0 border-b border-[var(--border)] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-faint)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une conversation…"
                aria-label="Rechercher une conversation"
                className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-9 pr-8 text-[12.5px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-faint)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)]/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--foreground-faint)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loadingList ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] p-2.5">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--surface-muted)]" />
                      <div className="h-2.5 w-3/5 animate-pulse rounded bg-[var(--surface-muted)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listError ? (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <p className="text-[12px] text-red-600 dark:text-red-400">{listError}</p>
                <button
                  type="button"
                  onClick={() => void loadConversations()}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground-subtle)] hover:bg-[var(--surface-muted)]"
                >
                  Réessayer
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--primary)]">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">
                    {search.trim() ? "Aucune conversation trouvée" : "Aucune conversation"}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--foreground-faint)]">
                    {search.trim()
                      ? "Essayez un autre nom ou un autre mot-clé."
                      : "Démarrez un échange privé avec un professeur ou l'administration."}
                  </p>
                </div>
                {!search.trim() && (
                  <button
                    type="button"
                    onClick={openDirectory}
                    className="mt-1 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
                  >
                    Nouvelle conversation
                  </button>
                )}
              </div>
            ) : (
              <ul className="py-1">
                {filtered.map((conversation) => {
                  const active = conversation.id === selectedId;
                  const unread = conversation.unreadCount > 0;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                          active
                            ? "bg-gradient-to-r from-[var(--primary)]/[0.12] to-[var(--primary)]/[0.02]"
                            : "hover:bg-[var(--surface-muted)]"
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--primary)]"
                          />
                        )}
                        <div
                          className={cn(
                            "relative shrink-0 rounded-full transition-shadow",
                            active
                              ? "ring-2 ring-[var(--primary)]/30 ring-offset-2 ring-offset-[var(--surface)]"
                              : ""
                          )}
                        >
                          <UserAvatar
                            userId={conversation.other.id}
                            nom={conversation.other.nom}
                            prenom={conversation.other.prenom}
                            hasImage={Boolean(conversation.other.image)}
                            size="md"
                          />
                          {isOnline(conversation.other.lastSeenAt) && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-emerald-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-baseline gap-1.5">
                              <p
                                className={cn(
                                  "truncate text-[13px] leading-tight",
                                  unread
                                    ? "font-semibold text-[var(--foreground)]"
                                    : "font-medium text-[var(--foreground)]"
                                )}
                              >
                                {fullName(conversation.other)}
                              </p>
                              {conversation.other.role !== "eleve" && (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide",
                                    conversation.other.role === "admin"
                                      ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                                      : "bg-[var(--primary)]/10 text-[var(--primary)]"
                                  )}
                                >
                                  {ROLE_LABELS[conversation.other.role]}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[10px]",
                                unread
                                  ? "font-semibold text-[var(--primary)]"
                                  : "text-[var(--foreground-faint)]"
                              )}
                            >
                              {formatListTime(conversation.lastMessageAt)}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-[11.5px] leading-tight",
                                unread
                                  ? "font-medium text-[var(--foreground-subtle)]"
                                  : "text-[var(--foreground-faint)]"
                              )}
                            >
                              {conversation.lastMessage
                                ? `${
                                    conversation.lastMessage.senderId === meId ? "Vous : " : ""
                                  }${previewText(conversation.lastMessage.content)}`
                                : "Nouvelle conversation"}
                            </p>
                            {unread && (
                              <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white shadow-[var(--shadow-xs)]">
                                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </>
        ) : (
          <ChatDirectory
            role={role}
            conversations={conversations}
            pickingId={pickingId}
            error={pickError}
            focusKey={directoryFocus}
            onClearError={() => setPickError(null)}
            onPick={(user) => void handlePick(user)}
            onOpenConversation={selectConversation}
          />
        )}
      </aside>

      <div className={cn("min-w-0 flex-1 bg-[var(--surface)]", selectedId ? "flex" : "hidden md:flex")}>
        {selectedId ? (
          <ChatThread
            key={selectedId}
            conversationId={selectedId}
            meId={meId}
            summary={selectedSummary}
            onBack={closeThread}
            onRead={handleRead}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--primary)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
              {panel === "annuaire" ? <Users className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {panel === "annuaire" ? "Annuaire du centre" : "Vos messages"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--foreground-faint)]">
                {panel === "annuaire"
                  ? "Choisissez un professeur, un élève ou un membre de l'administration pour ouvrir un échange privé."
                  : "Sélectionnez une conversation à gauche ou démarrez un nouvel échange privé avec un professeur, un élève ou l'administration."}
              </p>
            </div>
            {panel === "discussions" ? (
              <button
                type="button"
                onClick={openDirectory}
                className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                <SquarePen className="h-4 w-4" />
                Nouvelle conversation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPanel("discussions")}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--foreground-subtle)] shadow-xs transition hover:bg-[var(--surface-muted)]"
              >
                <MessageCircle className="h-4 w-4" />
                Revenir aux discussions
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
