"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, List, LogOut, Map as MapIcon } from "lucide-react";

/** Ruoli ammessi nel pannello. Gli operatori vedono solo la mappa operativa. */
const PANEL_ROLES = ["referent", "superadmin", "admin_ente", "operator"];
const OPERATOR_HOME = "/admin/mappa";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Errore recupero profilo:", error);
          setIsAuthorized(false);
          return;
        }

        if (profile?.role && PANEL_ROLES.includes(profile.role)) {
          setRole(profile.role);
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error("Errore recupero profilo (eccezione):", err);
        setIsAuthorized(false);
      }
    }

    checkAuth();
  }, [router]);

  // Gli operatori di campo lavorano solo sulla mappa operativa
  useEffect(() => {
    if (role === "operator" && pathname !== OPERATOR_HOME) router.replace(OPERATOR_HOME);
  }, [role, pathname, router]);

  const handleLogout = async () => {
    localStorage.removeItem("operatorData");
    localStorage.removeItem("userRole");
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
  };

  if (isAuthorized === null || (role === "operator" && pathname !== OPERATOR_HOME)) {
    return (
      <div className="flex flex-1 justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-1 justify-center items-center bg-slate-50 p-4">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold mb-2 text-rose-800">Accesso Negato</h2>
          <p className="text-slate-600 mb-6">Non hai i permessi per visualizzare il pannello di controllo.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Torna alla Mappa
          </button>
        </div>
      </div>
    );
  }

  const links = [
    ...(role === "superadmin" || role === "referent"
      ? [{ href: "/admin/superadmin", label: "Gestione Comuni", icon: Building2 }]
      : []),
    { href: "/admin/mappa", label: "Mappa operativa", icon: MapIcon },
    ...(role !== "operator"
      ? [{ href: "/admin", label: role === "admin_ente" ? "Elenco e operatori" : "Elenco idranti", icon: List }]
      : []),
  ];

  const isMapPage = pathname === "/admin/mappa";

  return (
    <div className="flex flex-1 min-h-0 flex-col md:flex-row bg-slate-50">
      {/* Menu del pannello: barra orizzontale sul telefono, colonna laterale da computer */}
      <aside className="flex shrink-0 items-center gap-1 overflow-x-auto bg-slate-900 px-2 py-2 text-slate-300 md:w-64 md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:p-0">
        <div className="hidden p-6 border-b border-slate-800 md:block">
          <p className="text-xl font-black text-white tracking-tight">IDRANTYA</p>
          <p className="text-xs mt-1 text-slate-400">Pannello di Controllo</p>
        </div>
        <nav className="flex flex-1 gap-1 md:flex-col md:space-y-1 md:p-4">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors md:px-4 md:py-3 ${
                  active ? "bg-slate-700 text-white" : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 md:border-t md:border-slate-800 md:p-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-300 transition-colors hover:bg-slate-800 hover:text-rose-200"
          >
            <LogOut size={18} aria-hidden="true" />
            Esci
          </button>
        </div>
      </aside>

      {/* La mappa occupa tutto lo spazio; le altre pagine scorrono */}
      <main className={`flex flex-1 min-h-0 flex-col ${isMapPage ? "" : "overflow-y-auto"}`}>
        {children}
      </main>
    </div>
  );
}
