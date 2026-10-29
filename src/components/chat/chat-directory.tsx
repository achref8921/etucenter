"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  Users,
  X,
} from "lucide-react";
import UserAvatar from "@/components/user-avatar";
import { SegmentedTabs } from "@/components/chat/segmented-tabs";
import { cn } from "@/lib/utils";
import { fullName, isOnline } from "./chat-utils";
import type {
  ChatConversationSummary,
  ChatDirectory,
  ChatDirectoryUser,
  ChatRole,
} from "@/types/chat";

interface ChatDirectoryProps {
  role: ChatRole;
  conversations: ChatConversationSummary[];
  pickingId: string | null;
  error: string | null;
  focusKey: number;
  onClearError: () => void;
  onPick: (user: ChatDirectoryUser) => void;
  onOpenConversation: (conversationId: string) => void;
}

type Tab = "contacts" | "eleves";

function studentGroupsLabel(user: ChatDirectoryUser): string {
  if (user.groups.length === 0) return "Sans groupe";
  return user.groups.map((group) => group.nom).join(" · ");
}

function contactSubtitle(user: ChatDirectoryUser): string {
  if (user.role === "eleve") return studentGroupsLabel(user);
  if (user.role === "prof") {
    const groups = user.groupCount
      ? `${user.groupCount} groupe${user.groupCount > 1 ? "s" : ""}`
      : "Aucun groupe";
    return user.email ? `${groups} · ${user.email}` : groups;
  }
  return user.email || "Administration";
}

export default function ChatDirectory({
  role,
  conversations,
  pickingId,
  error,
  focusKey,
  onClearError,
  onPick,
  onOpenConversation,
}: ChatDirectoryProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("contacts");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [data, setData] = useState<ChatDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusKey > 0) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
  }, [focusKey]);

  // Changer de section, de groupe ou de recherche repart du haut de la liste.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [tab, groupFilter, query]);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (tab === "eleves") {
        if (groupFilter === "none") params.set("ungrouped", "1");
        else if (groupFilter !== "all") params.set("groupId", groupFilter);
      }
      if (offset > 0) params.set("offset", String(offset));
      return params;
    },
    [groupFilter, query, tab]
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = buildParams(0);
        const response = await fetch(`/api/messages/directory?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setLoadError(payload?.error || "Impossible de charger l'annuaire.");
          setData(null);
          return;
        }
        setData(payload as ChatDirectory);
      } catch (fetchError) {
        if (!active || (fetchError as Error)?.name === "AbortError") return;
        setLoadError("Connexion impossible. Vérifiez votre réseau.");
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }, query.trim() ? 250 : 0);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [buildParams, retryKey]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || !data.hasMore) return;
    setLoadingMore(true);
    try {
      const params = buildParams(data.eleves.length);
      const response = await fetch(`/api/messages/directory?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as ChatDirectory & {
        error?: string;
      };
      if (!response.ok) {
        setLoadError(payload?.error || "Impossible de charger la suite.");
        return;
      }
      setData((previous) =>
        previous
          ? {
              ...payload,
              eleves: [...previous.eleves, ...(payload.eleves ?? [])],
            }
          : payload
      );
    } catch {
      setLoadError("Connexion impossible. Réessayez.");
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, data, loadingMore]);

  const conversationByUser = useMemo(() => {
    const map = new Map<string, ChatConversationSummary>();
    for (const conversation of conversations) map.set(conversation.other.id, conversation);
    return map;
  }, [conversations]);

  const openContact = useCallback(
    (user: ChatDirectoryUser) => {
      onClearError();
      const existing = conversationByUser.get(user.id);
      if (existing) onOpenConversation(existing.id);
      else onPick(user);
    },
    [conversationByUser, onClearError, onOpenConversation, onPick]
  );

  const studentCount = data?.totalStudents ?? 0;
  const contactCount = data?.contacts.length ?? 0;
  const totalContactCount = data?.totalContacts ?? 0;
  const isStudentTab = tab === "eleves";

  const emptyStudents = isStudentTab && (data?.eleves.length ?? 0) === 0;

  const renderRow = (user: ChatDirectoryUser) => {
    const conversation = conversationByUser.get(user.id);
    const picking = pickingId === user.id;
    const unread = conversation?.unreadCount ?? 0;
    return (
      <li key={user.id}>
        <button
          type="button"
          onClick={() => openContact(user)}
          disabled={Boolean(pickingId)}
          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          <div className="relative shrink-0">
            <UserAvatar
              userId={user.id}
              nom={user.nom}
              prenom={user.prenom}
              hasImage={Boolean(user.image)}
              size="sm"
            />
            {isOnline(user.lastSeenAt) && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-[var(--foreground)]">
              {fullName(user)}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--foreground-faint)]">
              {contactSubtitle(user)}
            </p>
          </div>
          {picking ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" />
          ) : unread > 0 ? (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : conversation ? (
            <MessageCircle className="h-4 w-4 shrink-0 text-[var(--foreground-faint)]" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--foreground-faint)]" />
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {role !== "eleve" && (
        <div className="shrink-0 px-3 pt-2.5">
          <SegmentedTabs
            ariaLabel="Sections de l'annuaire"
            value={tab}
            onChange={(key) => {
              if (key === "contacts") {
                setTab("contacts");
                setGroupFilter("all");
              } else {
                setTab("eleves");
              }
            }}
            items={[
              {
                key: "contacts",
                label: data?.contactsLabel ?? (role === "prof" ? "Administration" : "Professeurs"),
                badge: data ? totalContactCount : "…",
                badgeTone: "muted",
              },
              {
                key: "eleves",
                label: role === "prof" ? "Mes élèves" : "Élèves",
                badge: data ? studentCount : "…",
                badgeTone: "muted",
              },
            ]}
          />
        </div>
      )}

      <div className="shrink-0 px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un nom ou un email…"
            aria-label="Rechercher un contact"
            className="h-9 w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] pl-9 pr-8 text-[12.5px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-faint)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--foreground-faint)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isStudentTab && (data?.groups.length ?? 0) > 0 && (
        <div className="shrink-0 border-b border-[var(--border)]">
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setGroupFilter("all")}
              aria-pressed={groupFilter === "all"}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                groupFilter === "all"
                  ? "border-[var(--primary)] bg-[var(--primary)]/[0.08] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--foreground-subtle)] hover:bg-[var(--surface-muted)]"
              )}
            >
              Tous
              <span className="text-[10px] font-bold text-[var(--foreground-faint)]">{studentCount}</span>
            </button>
            {data?.groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setGroupFilter(group.id)}
                aria-pressed={groupFilter === group.id}
                title={[group.matiere, group.profName].filter(Boolean).join(" · ")}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  groupFilter === group.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/[0.08] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--foreground-subtle)] hover:bg-[var(--surface-muted)]"
                )}
              >
                {group.nom}
                <span className="text-[10px] font-bold text-[var(--foreground-faint)]">{group.count}</span>
              </button>
            ))}
            {role === "admin" && (data?.ungroupedCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setGroupFilter("none")}
                aria-pressed={groupFilter === "none"}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  groupFilter === "none"
                    ? "border-[var(--primary)] bg-[var(--primary)]/[0.08] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--foreground-subtle)] hover:bg-[var(--surface-muted)]"
                )}
              >
                Sans groupe
                <span className="text-[10px] font-bold text-[var(--foreground-faint)]">
                  {data?.ungroupedCount}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {(error || loadError) && (
          <p className="mx-3 mt-2 rounded-[var(--radius-md)] bg-red-50 px-3 py-2 text-[11.5px] text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error || loadError}
            {loadError && !error && (
              <button
                type="button"
                onClick={() => setRetryKey((key) => key + 1)}
                className="ml-2 font-semibold underline"
              >
                Réessayer
              </button>
            )}
          </p>
        )}

        {loading && !data ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] p-2.5">
                <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-2/5 animate-pulse rounded bg-[var(--surface-muted)]" />
                  <div className="h-2 w-3/5 animate-pulse rounded bg-[var(--surface-muted)]" />
                </div>
              </div>
            ))}
          </div>
        ) : role === "eleve" ? (
          <div className="pb-2">
            {(["prof", "admin"] as const).map((roleKey) => {
              const items = (data?.contacts ?? []).filter((contact) => contact.role === roleKey);
              if (items.length === 0) return null;
              return (
                <section key={roleKey}>
                  <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    {roleKey === "prof" ? "Professeurs" : "Administration"}
                  </p>
                  <ul>{items.map(renderRow)}</ul>
                </section>
              );
            })}
            {(data?.contacts.length ?? 0) === 0 && !loading && (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground-faint)]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">Aucun contact</p>
                <p className="max-w-xs text-[11px] leading-relaxed text-[var(--foreground-faint)]">
                  {query.trim()
                    ? "Essayez un autre nom."
                    : "Vous n'avez pas encore de contact disponible pour la messagerie."}
                </p>
              </div>
            )}
          </div>
        ) : isStudentTab ? (
          <div className="pb-2">
            {query.trim() && !loading && (data?.contacts.length ?? 0) > 0 && emptyStudents && (
              <div className="px-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("contacts")}
                  className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--primary)]/[0.06] px-3 py-2 text-left text-[11.5px] font-medium text-[var(--primary)]"
                >
                  <span>
                    {data?.contacts.length} {data?.contactsLabel.toLowerCase()} correspondant
                    {(data?.contacts.length ?? 0) > 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {emptyStudents && !loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground-faint)]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  {query.trim()
                    ? "Aucun élève trouvé"
                    : groupFilter !== "all"
                      ? "Aucun élève dans cette sélection"
                      : "Aucun élève"}
                </p>
                <p className="max-w-xs text-[11px] leading-relaxed text-[var(--foreground-faint)]">
                  {query.trim()
                    ? "Essayez un autre nom ou choisissez un autre groupe."
                    : "Les élèves apparaissent ici dès qu'ils sont inscrits à un groupe."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    {groupFilter === "all"
                      ? "Tous les élèves"
                      : groupFilter === "none"
                        ? "Élèves sans groupe"
                        : data?.groups.find((group) => group.id === groupFilter)?.nom ?? "Élèves"}
                  </p>
                  <span className="text-[10px] font-medium text-[var(--foreground-faint)]">
                    {data?.totalEleves ?? 0}
                  </span>
                </div>
                <ul>{data?.eleves.map(renderRow)}</ul>
                {data?.hasMore && (
                  <div className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                      className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] py-2 text-[11.5px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    >
                      {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Afficher plus d&apos;élèves
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="pb-2">
            {(data?.contacts.length ?? 0) === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground-faint)]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Aucun {role === "prof" ? "administrateur" : "professeur"} trouvé
                </p>
                <p className="max-w-xs text-[11px] leading-relaxed text-[var(--foreground-faint)]">
                  {query.trim()
                    ? "Essayez un autre nom ou un autre email."
                    : "Aucun contact disponible pour le moment."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    {data?.contactsLabel ?? "Contacts"}
                  </p>
                  <span className="text-[10px] font-medium text-[var(--foreground-faint)]">
                    {contactCount}
                  </span>
                </div>
                <ul>{data?.contacts.map(renderRow)}</ul>
                {query.trim() && (data?.totalEleves ?? 0) > 0 && (
                  <div className="px-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setTab("eleves")}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--primary)]/[0.06] px-3 py-2 text-left text-[11.5px] font-medium text-[var(--primary)]"
                    >
                      <span>
                        {data?.totalEleves} élève{(data?.totalEleves ?? 0) > 1 ? "s" : ""} correspondant
                        {(data?.totalEleves ?? 0) > 1 ? "s" : ""}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
