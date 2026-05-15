import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { createSupabaseServerClient, requireRole } from "@/lib/supabase/server";

export default async function SuperAdminDashboardPage() {
  const { profile } = await requireRole(["super_admin"]);
  const supabase = await createSupabaseServerClient();

  const [{ count: municipalities }, { count: users }, { count: hydrants }] = supabase
    ? await Promise.all([
        supabase.from("municipalities").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("hydrants").select("id", { count: "exact", head: true }),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }];

  return (
    <DashboardShell
      profile={profile}
      title="Console super admin"
      subtitle="Governa comuni, utenti e consistenza complessiva del catasto idranti."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Comuni" value={municipalities ?? 0} detail="Tenant attivi in piattaforma" />
        <StatCard label="Utenti" value={users ?? 0} detail="Profili con ruolo applicativo" />
        <StatCard label="Idranti" value={hydrants ?? 0} detail="Record censiti su tutti i comuni" />
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Governance multi-tenant</h2>
        <p className="mt-2 text-sm text-slate-600">
          Usa Supabase per creare comuni, associare profili e assegnare ruoli. Le policy RLS
          separano i dati comunali e lasciano al super admin la vista trasversale.
        </p>
      </section>
    </DashboardShell>
  );
}
