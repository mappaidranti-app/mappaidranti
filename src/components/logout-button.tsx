"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-red-600 hover:text-red-800 font-medium"
    >
      Esci
    </button>
  );
}
