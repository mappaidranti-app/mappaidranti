import Link from "next/link";
import { Building2, Flame } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import type { UserProfile } from "@/types/auth";

export function DashboardShell({
  profile,
  title,
  subtitle,
  children,
}: {
  profile: UserProfile;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-700 text-white">
              <Flame size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">Mappa Idranti</p>
              <p className="truncate text-xs text-slate-600">{roleLabel(profile.role)}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex">
              <Building2 size={16} aria-hidden="true" />
              <span className="max-w-44 truncate">{profile.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Area riservata
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

function roleLabel(role: UserProfile["role"]) {
  const labels = {
    super_admin: "Super admin",
    client_admin: "Client admin",
    surveyor: "Surveyor",
  };

  return labels[role];
}
