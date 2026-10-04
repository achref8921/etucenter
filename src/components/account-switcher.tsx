"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Link2, Loader2, Trash2, X } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { useToast } from "@/components/ui/toast";
import type { LinkedAccount } from "@/types/next-auth";

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

export default function AccountSwitcher() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const linked: LinkedAccount[] = Array.isArray(session?.linked) ? session!.linked! : [];
  const currentId = user?.id;
  const hasLinked = linked.length > 0;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowModal(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", body.error || "Liaison impossible");
        return;
      }
      toast("success", "Compte lié. Vous pouvez basculer dessus à tout moment.");
      setEmail("");
      setMotDePasse("");
      setShowModal(false);
      router.refresh();
    } catch {
      toast("error", "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitch(targetId: string) {
    if (switchingId) return;
    setSwitchingId(targetId);
    setOpen(false);
    try {
      const res = await fetch("/api/account/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", body.error || "Bascule impossible");
        return;
      }
      const role = body.role as string | undefined;
      const home = role && HOME_BY_ROLE[role] ? HOME_BY_ROLE[role] : "/";
      router.push(home);
      router.refresh();
    } catch {
      toast("error", "Erreur réseau");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleUnlink(targetId: string) {
    if (unlinkingId) return;
    setUnlinkingId(targetId);
    try {
      const res = await fetch("/api/account/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (!res.ok) {
        toast("error", "Dépose impossible");
        return;
      }
      toast("success", "Compte délié");
      router.refresh();
    } catch {
      toast("error", "Erreur réseau");
    } finally {
      setUnlinkingId(null);
    }
  }

  const currentInitials = `${user?.prenom?.[0] ?? ""}${user?.nom?.[0] ?? ""}`;

  return (
    <>
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Changer de compte"
          aria-label="Changer de compte"
          className="relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 sm:px-2.5 dark:text-neutral-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">Comptes</span>
          {switchingId && (
            <Loader2 className="absolute -right-1 -top-1 h-3 w-3 animate-spin text-indigo-500" />
          )}
          {hasLinked && !switchingId && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
              {linked.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-[#2a2d35] dark:bg-[#181b22]">
            <div className="border-b border-neutral-100 px-3 py-2 dark:border-[#2a2d35]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Compte actuel</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-[10px] font-semibold text-white">
                  {currentInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="truncate text-[11px] text-neutral-400">{user?.email}</p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {linked.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] leading-relaxed text-neutral-400">
                  Aucun compte lié.
                  <br />
                  Liez votre second compte pour basculer sans vous déconnecter.
                </p>
              ) : (
                linked.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2 last:border-b-0 dark:border-[#2a2d35]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600 dark:bg-[#2a2d35] dark:text-neutral-300">
                      {acc.prenom?.[0]}
                      {acc.nom?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                        {acc.prenom} {acc.nom}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400">
                        {roleLabels[acc.role] || acc.role} · {acc.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlink(acc.id)}
                      disabled={unlinkingId === acc.id}
                      title="Déposer ce compte"
                      aria-label={`Déposer le compte ${acc.prenom} ${acc.nom}`}
                      className="shrink-0 rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      {unlinkingId === acc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitch(acc.id)}
                      disabled={switchingId === acc.id}
                      title="Basculer sur ce compte"
                      className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                    >
                      {switchingId === acc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Basculer"
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-neutral-100 p-2 dark:border-[#2a2d35]">
              <button
                type="button"
                onClick={() => {
                  setShowModal(true);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-[#232830]"
              >
                <Link2 className="h-3.5 w-3.5" />
                Lier un autre compte
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-[#2a2d35] dark:bg-[#181b22]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
                  Lier un autre compte
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Saisissez le mot de passe du second compte pour prouver qu&apos;il vous appartient. Vous
                  pourrez ensuite basculer sans vous déconnecter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fermer"
                className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-[#232830]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLink} className="space-y-3">
              <div>
                <label
                  htmlFor="switch-email"
                  className="mb-1 block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200"
                >
                  Email du second compte
                </label>
                <input
                  id="switch-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors focus:border-indigo-400 dark:border-[#2a2d35] dark:bg-[#0f1114] dark:text-neutral-100"
                />
              </div>

              <div>
                <label
                  htmlFor="switch-password"
                  className="mb-1 block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200"
                >
                  Mot de passe
                </label>
                <PasswordInput
                  id="switch-password"
                  autoComplete="off"
                  required
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors focus:border-indigo-400 dark:border-[#2a2d35] dark:bg-[#0f1114] dark:text-neutral-100"
                />
              </div>

              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                Les comptes liés sont conservés uniquement jusqu&apos;à votre déconnexion. Chaque bascule est
                enregistrée dans le journal du système.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-[13px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-[#2a2d35] dark:text-neutral-300 dark:hover:bg-[#232830]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Lier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}