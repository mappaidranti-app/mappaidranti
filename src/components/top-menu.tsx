"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Flame, LayoutDashboard, LogOut, Map as MapIcon } from "lucide-react";
import { getUserRole } from "../app/admin/actions";

/** Ruoli che hanno accesso al pannello di controllo */
const PANEL_ROLES = ["referent", "superadmin", "admin_ente"];

/**
 * Barra in alto: nome dell'app ben visibile, titolo della pagina e un solo tasto d'azione.
 * - Mappa di consultazione: tasto PANNELLO DI CONTROLLO (porta al login se non si è entrati)
 * - Pannello di controllo: tasto per tornare alla mappa (l'uscita è nel menu del pannello)
 */
export function TopMenu() {
  const [role, setRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoggedIn(false);
        setRole(null);
        return;
      }
      setIsLoggedIn(true);
      // Ruolo verificato lato server a partire dal token di sessione
      const { role } = await getUserRole(session.access_token);
      setRole(role);
    }

    checkAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange(() => {
      checkAuth();
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("operatorData");
    localStorage.removeItem("userRole");
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
  };

  if (pathname === "/login") return null;

  const isPanel = pathname.startsWith("/admin");
  const canOpenPanel = !!role && PANEL_ROLES.includes(role);
  const panelHref = role === "superadmin" ? "/admin/superadmin" : "/admin";

  const buttonClass =
    "flex shrink-0 items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-black uppercase tracking-wide shadow-sm transition active:scale-95";

  return (
    <header className="relative z-[9999] flex w-full items-center justify-between gap-3 bg-white px-4 py-2.5 shadow">
      <Link href="/" className="flex items-center gap-2.5 min-w-0">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-md shadow-red-600/30">
          <Flame size={22} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-black leading-none tracking-tight text-red-700">IDRANTYA</span>
          <span className="block truncate text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
            {isPanel ? "Pannello di controllo" : "Consultazione"}
          </span>
        </span>
      </Link>

      {isPanel ? (
        <Link href="/" className={`${buttonClass} bg-slate-100 text-slate-800 hover:bg-slate-200`}>
          <MapIcon size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Mappa</span>
        </Link>
      ) : canOpenPanel ? (
        <Link href={panelHref} className={`${buttonClass} bg-slate-800 text-white hover:bg-slate-700`}>
          <LayoutDashboard size={18} aria-hidden="true" />
          <span className="sm:hidden">Pannello</span>
          <span className="hidden sm:inline">Pannello di controllo</span>
        </Link>
      ) : isLoggedIn ? (
        // Operatori di campo: per ora lavorano dalla mappa, serve solo poter uscire
        <button type="button" onClick={handleLogout} className={`${buttonClass} bg-slate-100 text-slate-800 hover:bg-slate-200`}>
          <LogOut size={18} aria-hidden="true" />
          <span>Esci</span>
        </button>
      ) : (
        // Visitatore: il pannello richiede l'accesso
        <Link
          href="/login"
          onClick={() => localStorage.removeItem("userRole")}
          className={`${buttonClass} bg-slate-800 text-white hover:bg-slate-700`}
        >
          <LayoutDashboard size={18} aria-hidden="true" />
          <span className="sm:hidden">Pannello</span>
          <span className="hidden sm:inline">Pannello di controllo</span>
        </Link>
      )}
    </header>
  );
}
