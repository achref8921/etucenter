import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  GraduationCap,
  Users,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Shield,
  ChevronRight,
  BookOpen,
  Bell,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestion des Eleves",
    description: "Inscription, suivi des informations personnelles et gestion des groupes.",
  },
  {
    icon: CalendarCheck,
    title: "Suivi des Presences",
    description: "Enregistrement en temps reel des presences et absences par seance.",
  },
  {
    icon: CreditCard,
    title: "Gestion Financiere",
    description: "Suivi des paiements, impayes et calcul automatique des benefices.",
  },
  {
    icon: BarChart3,
    title: "Tableaux de Bord",
    description: "Statistiques en temps reel : presences, revenus, eleves et alertes.",
  },
  {
    icon: Shield,
    title: "Multi-Utilisateurs",
    description: "Roles distincts : admin, prof et eleve avec acces securise.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Notifications en temps reel pour les inscriptions, paiements et alertes.",
  },
];

const steps = [
  {
    num: "01",
    title: "Creez votre centre",
    description: "Le super admin cree votre centre et vous attribue un compte administrateur.",
  },
  {
    num: "02",
    title: "Configurez vos donnees",
    description: "Ajoutez vos matieres, groupes, profs et eleves en quelques clics.",
  },
  {
    num: "03",
    title: "Gerez au quotidien",
    description: "Enregistrez les presences, suivez les paiements et consultez les statistiques.",
  },
];

const stats = [
  { value: "3+", label: "Centres actifs" },
  { value: "80+", label: "Eleves inscrits" },
  { value: "3500+", label: "Presences enregistrees" },
  { value: "55K+", label: "DT de revenus" },
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as any).role;
    if (role === "super_admin") redirect("/super-admin");
    if (role === "admin") redirect("/admin");
    if (role === "prof") redirect("/prof");
    redirect("/eleve");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">EduCenter</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
            >
              Inscription
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-950 dark:to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.1),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
              <BookOpen className="h-3.5 w-3.5" />
              Plateforme de gestion scolaire
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl">
              Gerez votre centre
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> en toute simplicite</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Suivi des presences, gestion des paiements, planning des seances et tableaux de bord en temps reel. Tout ce dont vous avez besoin pour gerer votre centre educatif.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="group flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200/50 dark:shadow-blue-900/20 dark:hover:shadow-blue-900/30"
              >
                Commencer gratuitement
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Tout ce qu&apos;il vous faut
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Une suite complete d&apos;outils pour gerer efficacement votre centre educatif.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:group-hover:bg-blue-900/30">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              Comment ca marche ?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Demarrez en 3 etapes simples.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.num} className="relative text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-7 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-blue-200 to-transparent md:block dark:from-blue-800" />
                )}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-16 text-center shadow-xl shadow-blue-200/50 sm:px-16 dark:shadow-blue-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Pret a commencer ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-blue-100">
              Rejoignez les centres qui utilisent EduCenter pour gerer leurs eleves, profs et finances.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="group flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-blue-600 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl"
              >
                Creer un compte
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">EduCenter</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; 2026 EduCenter. Tous droits reserves.
          </p>
        </div>
      </footer>
    </div>
  );
}
