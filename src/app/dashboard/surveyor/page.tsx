import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { SurveyorMapPanel } from "@/components/surveyor-map-panel";

export default async function SurveyorDashboardPage() {
  const { profile } = await requireRole(["surveyor"]);

  if (!profile.municipality_id) {
    redirect("/dashboard");
  }

  return <SurveyorMapPanel municipalityId={profile.municipality_id} />;
}
