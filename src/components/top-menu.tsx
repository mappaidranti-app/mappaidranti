"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getUserRole } from "../app/admin/actions";

export function TopMenu() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReferent, setIsReferent] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isVisitor, setIsVisitor] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      const userRole = localStorage.getItem("userRole");
      if (userRole === "visitor") {
        setIsVisitor(true);
        setIsAuthenticated(true);
        setIsReferent(false);
        setIsSuperAdmin(false);
        return;
      }

      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setIsVisitor(false);
        // Check role securely via Server Action
        const { role } = await getUserRole(session.access_token);
        if (role === "referent") {
          setIsReferent(true);
        } else if (role === "superadmin") {
          setIsSuperAdmin(true);
        }
      } else {
        setIsAuthenticated(false);
        setIsReferent(false);
        setIsSuperAdmin(false);
        setIsVisitor(false);
      }
    }

    checkAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setIsAuthenticated(true);
          checkAuth(); // Re-check role on login
        } else {
          // Verify if operator is still logged in before setting false
          if (localStorage.getItem("userRole") !== "visitor") {
            setIsAuthenticated(false);
            setIsReferent(false);
            setIsSuperAdmin(false);
            setIsVisitor(false);
          }
        }
      }
    ) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    // Clear local sessions
    localStorage.removeItem("operatorData");
    localStorage.removeItem("userRole");
    
    if (supabase) {
      await supabase.auth.signOut();
    }
    
    setIsAuthenticated(false);
    setIsReferent(false);
    setIsSuperAdmin(false);
    setIsVisitor(false);
    router.push("/login");
  };

  // Se siamo nella pagina di login, non mostriamo i tasti del menu (tranne il titolo)
  if (pathname === "/login") {
    return null;
  }

  if (!isAuthenticated) return null;

  return (
    <nav className="flex items-center space-x-4">
      {isVisitor && (
        <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-md">
          Modalità Visitatore
        </span>
      )}
      <Link 
        href="/"
        className={`text-sm font-medium transition-colors ${
          pathname === "/" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Mappa
      </Link>
      
      {(isReferent || isSuperAdmin) && (
        <Link 
          href={isSuperAdmin ? "/admin/superadmin" : "/admin"}
          className={`text-sm font-medium transition-colors ${
            pathname.startsWith("/admin") ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pannello di Controllo
        </Link>
      )}

      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-bold ml-4 border-l border-gray-200 pl-4 transition-colors"
      >
        {isVisitor ? "🚪 Esci (Login)" : "🚪 Logout"}
      </button>
    </nav>
  );
}
