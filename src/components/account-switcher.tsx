"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import PasswordInput from "@/components/password-input";
import UserAvatar from "@/components/user-avatar";
import { useToast } from "@/components/ui/toast";
import type { AccountUser, LinkedAccount } from "@/types/next-auth";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  prof: "Prof",
  eleve: "Eleve",
};

const HOME_BY_ROLE: Record<string, string> = {
  super_admin: "/super-admin",
  admin: "/admin",
  prof: "/prof",
  eleve: "/eleve",
};

const MAX_LINKED = 3;

interface AccountSwitcherProps {
  trigger?: React.ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
  fallbackUser?: AccountUser | null;
}

export default function AccountSwitcher({
  trigger,
  triggerClassName,
  align = "right",
  fallbackUser,
}: AccountSwitcherProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const user = session?.user ?? fallbackUser;
  const linked: LinkedAccount[] = session?.linked ?? [];
  const hasLinked = linked.length > 0;
  const avatarVersion = user?.image?.match(/[?&]v=(\d+)/)?.[1] ?? null;
  const role = (user?.role as string) || "";
  const limitReached = linked.length >= MAX_LINKED;

  useEffect(() => {
    setMounted(true);
  }, []);

  function computeMenuPosition() {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const isPhone = window.innerWidth < 640;
    const width = isPhone ? Math.min(window.innerWidth - 24, 352) : 352;
    let left = align === "left" ? rect.left : rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const top = rect.bottom + 8;
    return { top, left, width, maxHeight: Math.max(180, window.innerHeight - top - 12) };
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function updatePosition() {
      const next = computeMenuPosition();
      if (next) setMenuPos(next);
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, align]);

  useEffect(() => {
    if (!showModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => emailRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) setShowModal(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showModal, saving]);

  function openAddAccount() {
    if (limitReached) {
      toast.info(`Maximum ${MAX_LINKED} comptes liés. Dissociez un compte pour en ajouter un autre.`);
      return;
    }
    setOpen(false);
    setError(null);
    setEmail("");
    setMotDePasse("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setError(null);
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);

    const targetEmail = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, motDePasse }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Impossible d'ajouter ce compte. Vérifiez vos identifiants.");
        return;
      }

      const nextLinked: LinkedAccount[] = Array.isArray(body?.linked) ? body.linked : [];
      const target = nextLinked.find((acc) => acc.email.toLowerCase() === targetEmail);

      if (!target) {
        toast.success("Compte ajouté");
        setShowModal(false);
        await update();
        router.refresh();
        return;
      }

      setSwitchingId(target.id);
      const switchRes = await fetch("/api/account/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id }),
      });
      const switchBody = await switchRes.json().catch(() => ({}));

      if (!switchRes.ok) {
        toast.error(switchBody?.error || "Compte ajouté, mais la bascule a échoué.");
        setShowModal(false);
        await update();
        router.refresh();
        return;
      }

      const nextRole = typeof switchBody?.role === "string" ? switchBody.role : "";
      window.location.href = HOME_BY_ROLE[nextRole] || "/";
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
      setSwitchingId(null);
    }
  }

  async function handleSwitch(id: string) {
    if (switchingId || unlinkingId) return;
    setSwitchingId(id);
    try {
      const res = await fetch("/api/account/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || "Echec du basculement");
        return;
      }
      const nextRole = typeof body?.role === "string" ? body.role : user?.role;
      window.location.href = (nextRole && HOME_BY_ROLE[nextRole]) || "/";
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleUnlink(id: string) {
    if (unlinkingId || switchingId) return;
    setUnlinkingId(id);
    try {
      const res = await fetch("/api/account/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || "Echec de la dissociation");
        return;
      }
      toast.success("Compte dissocié");
      await update();
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) setMenuPos(computeMenuPosition());
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Changer de compte"
        className={
          triggerClassName ??
          "flex items-center gap-1 rounded-full border border-neutral-200 bg-[var(--surface)] py-0.5 pl-0.5 pr-1.5 text-[11px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:bg-[#0f1114] dark:text-neutral-200 dark:hover:bg-[#141823]"
        }
        title="Changer de compte"
      >
        {trigger ?? (
          <UserAvatar
            userId={user?.id}
            nom={user?.nom}
            prenom={user?.prenom}
            hasImage={Boolean(user?.image)}
            version={avatarVersion}
            size="xs"
          />
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {mounted && open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="animate-pop-in fixed z-[90] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
          }}
        >
          <div className="flex items-start justify-between px-4 pb-3 pt-4">
            <div>
              <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">Comptes</p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Basculez sans ressaisir vos identifiants
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--surface-muted)] hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pb-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  key={user?.image ?? "no-avatar"}
                  userId={user?.id}
                  nom={user?.nom}
                  prenom={user?.prenom}
                  hasImage={Boolean(user?.image)}
                  version={avatarVersion}
                  size="md"
                  className="shadow-sm"
                  fallbackClassName="bg-[var(--primary)] text-[var(--primary-foreground)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                      {user?.prenom} {user?.nom}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Check className="h-2.5 w-2.5" /> Actif
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{user?.email}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                    {roleLabels[role] || role}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Autres comptes</p>
            <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              {linked.length}/{MAX_LINKED}
            </span>
          </div>

          <div className="px-2 pb-2">
            {linked.map((acc) => (
              <div
                key={acc.id}
                className="group flex items-center gap-1 rounded-xl p-0.5 transition-colors hover:bg-[var(--surface-muted)]"
              >
                <button
                  type="button"
                  onClick={() => handleSwitch(acc.id)}
                  disabled={Boolean(switchingId || unlinkingId)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserAvatar nom={acc.nom} prenom={acc.prenom} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                      {acc.prenom} {acc.nom}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">{acc.email}</span>
                    <span className="mt-0.5 inline-block text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                      {roleLabels[acc.role] || acc.role}
                    </span>
                  </span>
                  {switchingId === acc.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500 dark:text-neutral-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleUnlink(acc.id)}
                  disabled={Boolean(unlinkingId || switchingId)}
                  aria-label={`Dissocier ${acc.email}`}
                  title="Dissocier ce compte"
                  className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  {unlinkingId === acc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}

            {!hasLinked && (
              <div className="mx-1 rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-center">
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                  <UserPlus className="h-4 w-4" />
                </div>
                <p className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">Aucun autre compte</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Ajoutez un compte pour basculer instantanément.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] p-2">
            <button
              type="button"
              onClick={openAddAccount}
              disabled={limitReached}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Ajouter un compte
                </span>
                <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">
                  Connexion sécurisée, une seule fois
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
            {limitReached && (
              <p className="px-3 pb-1 pt-0.5 text-center text-[10px] text-neutral-400">
                Maximum {MAX_LINKED} comptes liés.
              </p>
            )}
            <div className="my-1 h-px bg-[var(--border)]" />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        </div>,
        document.body
      )}

      {mounted && showModal && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-account-title"
            className="animate-pop-in relative grid max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface)] shadow-2xl lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden"
          >
            <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b1b4d] via-[#12308a] to-[#1d4ed8] p-8 text-white lg:flex">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
                    <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Étudnet</p>
                    <p className="text-[11px] text-white/60">Plateforme éducative</p>
                  </div>
                </div>
                <h2 className="mt-10 max-w-xs text-2xl font-bold leading-tight">
                  Tous vos comptes,
                  <br />
                  un seul endroit.
                </h2>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/70">
                  Connectez un autre compte une seule fois, puis basculez entre vos espaces en un clic.
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    "Basculement instantané sans ressaisir vos identifiants",
                    "Chaque session reste sécurisée et isolée",
                    `Jusqu'à ${MAX_LINKED} comptes liés`,
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-white/75">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative mt-10 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[11px] font-medium text-white/80">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" /> Connexion vérifiée par Étudnet
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-white/50">
                  Votre mot de passe n&apos;est jamais stocké dans le navigateur.
                </p>
              </div>
            </div>

            <div className="relative p-5 sm:p-7 lg:p-8">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fermer"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--surface-muted)] hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 p-1.5 text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                  <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Étudnet</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Comptes</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                  <UserPlus className="h-5 w-5" />
                </span>
                <h2 id="add-account-title" className="mt-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Ajouter un compte
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Connectez-vous au compte que vous souhaitez lier à votre session actuelle.
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] font-medium leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label htmlFor="switch-email" className="mb-1.5 block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      ref={emailRef}
                      id="switch-email"
                      type="email"
                      autoComplete="off"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="vous@exemple.com"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-3 pl-10 pr-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)]/15 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label htmlFor="switch-password" className="block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
                      Mot de passe
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] font-medium text-[var(--primary)] hover:underline dark:text-[var(--accent-foreground)]"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <PasswordInput
                      id="switch-password"
                      autoComplete="off"
                      required
                      value={motDePasse}
                      onChange={(e) => {
                        setMotDePasse(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Votre mot de passe"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-3 pl-10 pr-10 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)]/15 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--surface-muted)] px-3.5 py-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                      Le mot de passe est utilisé uniquement pour vérifier ce compte et n&apos;est pas stocké.
                      Vous restez connecté à votre compte actuel jusqu&apos;à la bascule.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {switchingId ? "Ouverture de la session..." : saving ? "Vérification..." : "Se connecter et ajouter"}
                  </button>
                </div>
              </form>

              <p className="mt-4 text-center text-[10px] leading-relaxed text-neutral-400">
                En continuant, vous acceptez les conditions d&apos;utilisation d&apos;Étudnet.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
