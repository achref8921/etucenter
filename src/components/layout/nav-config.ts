import type { ComponentType } from "react";
import { Role } from "@/types/role";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Wallet,
  Calendar,
  ClipboardCheck,
  User,
  CreditCard,
  FileText,
  TrendingUp,
  Bell,
  Settings,
  BarChart3,
  Database,
  UserPlus,
  Banknote,
  Scale,
  Building2,
  Activity,
  ScrollText,
  MousePointerClick,
  MessageCircle,
} from "lucide-react";

export type IconType = ComponentType<{ className?: string }>;

export interface NavLeaf {
  label: string;
  href: string;
  icon: IconType;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: IconType;
  items: NavLeaf[];
}

export type NavSection = NavLeaf | NavGroup;

export interface NavFlags {
  peutGererEleves?: boolean;
  peutEncaisserReverse?: boolean;
}

export function isNavGroup(section: NavSection): section is NavGroup {
  return (section as NavGroup).items !== undefined;
}

export function roleHome(role: Role): string {
  return role === "super_admin" ? "/super-admin" : `/${role}`;
}

export function isHrefActive(pathname: string, href: string, home: string): boolean {
  if (pathname === href) return true;
  if (href === home) return false;
  return pathname.startsWith(href + "/");
}

export function isSectionActive(pathname: string, section: NavSection, home: string): boolean {
  if (isNavGroup(section)) return section.items.some((item) => isHrefActive(pathname, item.href, home));
  return isHrefActive(pathname, section.href, home);
}

const adminSections: NavSection[] = [
  { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Analytiques", href: "/admin/analytics", icon: BarChart3 },
  {
    key: "gestion",
    label: "Gestion",
    icon: GraduationCap,
    items: [
      { label: "Utilisateurs", href: "/admin/utilisateurs", icon: Users },
      { label: "Groupes", href: "/admin/groupes", icon: GraduationCap },
      { label: "Matières", href: "/admin/matieres", icon: BookOpen },
    ],
  },
  {
    key: "finances",
    label: "Finances",
    icon: Wallet,
    items: [
      { label: "Encaissements élèves", href: "/admin/finances", icon: Banknote },
      { label: "Comptes professeurs", href: "/admin/finances-professeurs", icon: CreditCard },
      { label: "Bénéfices", href: "/admin/benefices", icon: TrendingUp },
    ],
  },
  {
    key: "systeme",
    label: "Système",
    icon: Settings,
    items: [
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "Backup & Restauration", href: "/admin/backup", icon: Database },
      { label: "Paramètres", href: "/admin/parametres", icon: Settings },
    ],
  },
  { label: "Mon Profil", href: "/profil", icon: User },
];

function profSections(flags: NavFlags): NavSection[] {
  const enseignement: NavLeaf[] = [
    { label: "Mes Groupes", href: "/prof/groupes", icon: GraduationCap },
    { label: "Mes Séances", href: "/prof/seances", icon: Calendar },
    { label: "Mes Élèves", href: "/prof/eleves", icon: Users },
    { label: "Présences", href: "/prof/presences", icon: ClipboardCheck },
  ];
  if (flags.peutGererEleves) {
    enseignement.push({ label: "Gestion Élèves", href: "/prof/gestion-eleves", icon: UserPlus });
  }

  const finances: NavLeaf[] = [];
  if (flags.peutEncaisserReverse) {
    finances.push(
      { label: "Encaisser", href: "/prof/encaisser", icon: Banknote },
      { label: "Dettes Centre", href: "/prof/dettes", icon: Scale },
    );
  }
  finances.push({ label: "Mon Compte", href: "/prof/compte", icon: Wallet });

  return [
    { label: "Tableau de bord", href: "/prof", icon: LayoutDashboard },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { key: "enseignement", label: "Enseignement", icon: GraduationCap, items: enseignement },
    { key: "finances", label: "Finances", icon: Wallet, items: finances },
    { label: "Notifications", href: "/prof/notifications", icon: Bell },
    { label: "Mon Profil", href: "/profil", icon: User },
  ];
}

const eleveSections: NavSection[] = [
  { label: "Tableau de bord", href: "/eleve", icon: LayoutDashboard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  {
    key: "scolarite",
    label: "Scolarité",
    icon: GraduationCap,
    items: [
      { label: "Mes Groupes", href: "/eleve/groupes", icon: GraduationCap },
      { label: "Mes Présences", href: "/eleve/presences", icon: ClipboardCheck },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { label: "Mes Paiements", href: "/eleve/paiements", icon: FileText },
      { label: "Mon Compte", href: "/eleve/compte", icon: Wallet },
    ],
  },
  {
    key: "espace",
    label: "Mon Espace",
    icon: User,
    items: [
      { label: "Mon Profil", href: "/eleve/profil", icon: User },
      { label: "Notifications", href: "/eleve/notifications", icon: Bell },
    ],
  },
];

const superAdminSections: NavSection[] = [
  {
    key: "pilotage",
    label: "Pilotage",
    icon: BarChart3,
    items: [
      { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
      { label: "Centers", href: "/super-admin/centers", icon: Building2 },
      { label: "Utilisateurs", href: "/super-admin/utilisateurs", icon: Users },
      { label: "Analytiques", href: "/super-admin/analytics", icon: BarChart3 },
      { label: "Usage", href: "/super-admin/usage", icon: MousePointerClick },
    ],
  },
  {
    key: "exploitation",
    label: "Exploitation",
    icon: Activity,
    items: [
      { label: "Sauvegardes", href: "/super-admin/backups", icon: Database },
      { label: "Monitoring", href: "/super-admin/monitoring", icon: Activity },
      { label: "System Logs", href: "/super-admin/logs", icon: ScrollText },
    ],
  },
  { label: "Paramètres", href: "/super-admin/settings", icon: Settings },
];

export function getNavSections(role: Role, flags: NavFlags = {}): NavSection[] {
  switch (role) {
    case "admin":
      return adminSections;
    case "prof":
      return profSections(flags);
    case "eleve":
      return eleveSections;
    case "super_admin":
      return superAdminSections;
    default:
      return [];
  }
}

export function flattenSections(sections: NavSection[]): NavLeaf[] {
  const out: NavLeaf[] = [];
  for (const section of sections) {
    if (isNavGroup(section)) out.push(...section.items);
    else out.push(section);
  }
  return out;
}

export const navItemsByRole: Record<Role, NavLeaf[]> = {
  super_admin: flattenSections(superAdminSections),
  admin: flattenSections(adminSections),
  prof: flattenSections(profSections({ peutGererEleves: true, peutEncaisserReverse: true })),
  eleve: flattenSections(eleveSections),
};

const bottomNavByRole: Record<Role, NavLeaf[]> = {
  super_admin: [
    { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
    { label: "Centers", href: "/super-admin/centers", icon: Building2 },
    { label: "Users", href: "/super-admin/utilisateurs", icon: Users },
    { label: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
    { label: "Settings", href: "/super-admin/settings", icon: Settings },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Utilisateurs", href: "/admin/utilisateurs", icon: Users },
    { label: "Groupes", href: "/admin/groupes", icon: GraduationCap },
    { label: "Finances", href: "/admin/finances", icon: Wallet },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Profil", href: "/profil", icon: User },
  ],
  prof: [
    { label: "Dashboard", href: "/prof", icon: LayoutDashboard },
    { label: "Groupes", href: "/prof/groupes", icon: GraduationCap },
    { label: "Séances", href: "/prof/seances", icon: Calendar },
    { label: "Présences", href: "/prof/presences", icon: ClipboardCheck },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Élèves", href: "/prof/eleves", icon: Users },
  ],
  eleve: [
    { label: "Dashboard", href: "/eleve", icon: LayoutDashboard },
    { label: "Groupes", href: "/eleve/groupes", icon: GraduationCap },
    { label: "Présences", href: "/eleve/presences", icon: ClipboardCheck },
    { label: "Paiements", href: "/eleve/paiements", icon: FileText },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Profil", href: "/eleve/profil", icon: User },
  ],
};

export function getBottomNav(role: Role): NavLeaf[] {
  return bottomNavByRole[role] || [];
}
