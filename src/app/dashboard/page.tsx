import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export default async function DashboardIndexPage() {
  const { profile } = await requireUser();

  if (!profile) {
    redirect("/setup-required");
  }

  const destinations = {
    super_admin: "/dashboard/super-admin",
    client_admin: "/dashboard/client-admin",
    surveyor: "/dashboard/surveyor",
  };

  redirect(destinations[profile.role]);
}
