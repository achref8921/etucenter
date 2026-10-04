"use client";
  useEffect(() => setMounted(true), []);
  const user = mounted ? session?.user : undefined;
  const linked: LinkedAccount[] = mounted && Array.isArray((session as any)?.linked) ? ((session as any)!.linked as LinkedAccount[]) : [];
  const currentId = user?.id;
  const hasLinked = linked.length > 0;
  if (!mounted) return null;
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
