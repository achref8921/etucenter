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

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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

  const user = session?.user;
  const linked: LinkedAccount[] = Array.isArray((session as any)?.linked) ? ((session as any)!.linked as LinkedAccount[]) : [];
  const currentId = user?.id;
  const hasLinked = linked.length > 0;

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
        toast.error(body?.error || "Echec de la liaison");
        setSaving(false);
        return;
      }
      toast.success("Compte lié avec succès");
      setShowModal(false);
      setEmail("");
      setMotDePasse("");
      setSaving(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
      setSaving(false);
    }
  }

  async function handleSwitch(id: string) {
    if (switchingId) return;
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
        setSwitchingId(null);
        return;
      }
      const role = body?.role || user?.role;
      const dest = (role && HOME_BY_ROLE[role]) || "/";
      window.location.href = dest;
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
      setSwitchingId(null);
    }
  }

  async function handleUnlink(id: string) {
    if (unlinkingId) return;
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
        setUnlinkingId(null);
        return;
      }
      toast.success("Compte dissocié");
      setUnlinkingId(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
      setUnlinkingId(null);
    }
  }

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white pl-0.5 pr-1.5 py-0.5 text-[11px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#0f1114] dark:text-neutral-200 dark:hover:bg-[#141823]"
        title="Commutateur de comptes"
      >
        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-[10px] font-semibold uppercase text-neutral-500 dark:border-[#2a2d35] dark:bg-[#1a1d23] dark:text-neutral-400">
          {user?.image ? (
            <img src={user.image} alt={user?.name || "Profil"} className="h-full w-full object-cover" />
          ) : (
            `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}` || "U"
          )}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-xl border border-neutral-200 bg-white shadow-lg focus:outline-none dark:border-[#2a2d35] dark:bg-[#0f1114]">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-[#2a2d35]">
            <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Comptes liés</p>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Basculer entre vos comptes ou en lier un nouveau</p>
          </div>

          <div className="max-h-72 overflow-y-auto px-2 py-2">
            <div className="mb-2 rounded-lg bg-amber-50/70 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Un seul mot de passe demandé pour lier un second compte. Le basculement est libre ensuite.
            </div>

            <div className="space-y-1">
              {linked.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-[#141823]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-[10px] font-semibold uppercase text-neutral-500 dark:border-[#2a2d35] dark:bg-[#1a1d23] dark:text-neutral-400">
                      {acc.email?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">{acc.prenom} {acc.nom}</p>
                      <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{acc.email} • {roleLabels[acc.role] || acc.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {currentId === acc.id ? (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Actif
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={switchingId === acc.id}
                          onClick={() => handleSwitch(acc.id)}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-[#1a1d23]"
                        >
                          {switchingId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                          Basculer
                        </button>
                        <button
                          type="button"
                          disabled={unlinkingId === acc.id}
                          onClick={() => handleUnlink(acc.id)}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          {unlinkingId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Dissocier
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!hasLinked && (
                <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-center text-[11px] text-neutral-500 dark:border-[#2a2d35] dark:text-neutral-400">
                  Aucun compte lié pour le moment
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between border-t border-neutral-200 px-3 py-2 dark:border-[#2a2d35]">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-[#141823]"
            >
              <Link2 className="h-3.5 w-3.5" /> Ajouter un compte
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-[#141823]"
            >
              <X className="h-3.5 w-3.5" /> Fermer
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div ref={modalRef} className="w-full max-w-md rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-[#2a2d35] dark:bg-[#0f1114]">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-[#2a2d35]">
              <div>
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Lier un second compte</p>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Saisissez l'email et le mot de passe du compte à lier</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-[#141823] dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLink} className="space-y-3 px-5 py-4">
              <div>
                <label htmlFor="switch-email" className="mb-1 block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">Email du second compte</label>
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
                <label htmlFor="switch-password" className="mb-1 block text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">Mot de passe</label>
                <PasswordInput
                  id="switch-password"
                  autoComplete="off"
                  required
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors focus:border-indigo-400 dark:border-[#2a2d35] dark:bg-[#0f1114] dark:text-neutral-100"
                />
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                Vérifiez que l'email correspond bien au compte que vous souhaitez lier. Le mot de passe ne sera demandé qu'une seule fois.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-[#2a2d35] dark:text-neutral-200 dark:hover:bg-[#141823]">Annuler</button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-600">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Lier le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
