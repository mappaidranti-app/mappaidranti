"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export function TopMenu() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReferent, setIsReferent] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        // Check role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "referent") {
          setIsReferent(true);
        }
      } else {
        setIsAuthenticated(false);
        setIsReferent(false);
      }
    }

    checkAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setIsAuthenticated(true);
          checkAuth(); // Re-check role on login
        } else {
          setIsAuthenticated(false);
          setIsReferent(false);
        }
      }
    ) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setIsReferent(false);
      router.push("/login");
    }
  };

  // Se siamo nella pagina di login, non mostriamo i tasti del menu (tranne il titolo)
  if (pathname === "/login") {
    return null;
  }

  if (!isAuthenticated) return null;

  return (
    <nav className="flex items-center space-x-4">
      <Link 
        href="/"
        className={`text-sm font-medium transition-colors ${
          pathname === "/" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Mappa
      </Link>
      
      {isReferent && (
        <Link 
          href="/dashboard"
          className={`text-sm font-medium transition-colors ${
            pathname === "/dashboard" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pannello di Controllo
        </Link>
      )}

      <button
        onClick={handleLogout}
        className="text-sm text-red-600 hover:text-red-800 font-medium ml-4 border-l border-gray-200 pl-4"
      >
        Esci
      </button>
    </nav>
  );
}
