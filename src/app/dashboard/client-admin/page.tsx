import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { createSupabaseServerClient, requireRole } from "@/lib/supabase/server";

export default async function ClientAdminDashboardPage() {
  const { profile } = await requireRole(["client_admin"]);
  const supabase = await createSupabaseServerClient();

  if (!profile.municipality_id) {
    redirect("/setup-required");
  }

  const municipalityFilter = profile.municipality_id;
  const [{ count: hydrants }, { count: surveyors }, { count: offline }] = supabase
    ? await Promise.all([
        supabase
          .from("hydrants")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", municipalityFilter),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", municipalityFilter)
          .eq("role", "surveyor"),
        supabase
          .from("hydrants")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", municipalityFilter)
          .eq("status", "fuori_servizio"),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }];

  return (
    <DashboardShell
      profile={profile}
      title="Dashboard comune"
      subtitle="Monitora il catasto idranti e l'attivita dei rilevatori del tuo comune."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Idranti comunali" value={hydrants ?? 0} detail="Visibili nel tenant" />
        <StatCard label="Surveyor" value={surveyors ?? 0} detail="Rilevatori assegnati" />
        <StatCard label="Fuori servizio" value={offline ?? 0} detail="Priorita manutentive" />
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Operativita</h2>
        <p className="mt-2 text-sm text-slate-600">
          Il client admin vede solo dati e utenti del proprio comune. La mappa operativa resta
          riservata ai surveyor per il censimento sul campo.
        </p>
      </section>
    </DashboardShell>
  );
}
