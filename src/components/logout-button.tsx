"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    setIsLoading(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
      aria-label="Esci"
      title="Esci"
    >
      <LogOut size={18} aria-hidden="true" />
    </button>
  );
}
