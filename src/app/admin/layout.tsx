"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = async () => {
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

      if (profile?.role === "referent" || profile?.role === "superadmin" || profile?.role === "admin_ente") {
        setRole(profile.role);
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    } catch (err) {
      console.error("Errore recupero profilo (eccezione):", err);
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center p-4">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold mb-2 text-rose-800">Accesso Negato</h2>
          <p className="text-slate-600 mb-6">Non hai i permessi per visualizzare il pannello di controllo.</p>
          
          <div className="space-y-3">
            <button 
              onClick={() => router.push("/")} 
              className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Torna alla Mappa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-tight">IDRANTYA ADMIN</h1>
          <p className="text-xs mt-1 text-slate-400">Pannello di Controllo</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {(role === "superadmin" || role === "referent") && (
            <Link href="/admin/superadmin" className="block px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
              Gestione Comuni
            </Link>
          )}
          <Link href="/admin" className="block px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
            {role === "admin_ente" ? "Dashboard Ente" : "Lista Idranti"}
          </Link>
          {role === "admin_ente" && (
            <Link href="/" className="block px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
              Vai alla Mappa
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
