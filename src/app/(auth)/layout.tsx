import ThemeToggle from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/logo.svg"
            alt="Ètudna"
            className="mx-auto mb-4 h-16 w-16 object-contain drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ètudna</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plateforme éducative</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
          {children}
        </div>
      </div>
    </div>
  );
}
