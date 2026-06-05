"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const HydrantMap = dynamic(() => import("@/components/hydrant-map"), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-sm">
        Caricamento mappa idranti...
      </div>
    </main>
  ),
});

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) {
        setIsAuthenticated(false);
        router.push("/login");
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    }
    
    checkAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          router.push("/login");
        } else {
          setIsAuthenticated(true);
        }
      }
    ) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-sm flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-100"></div>
          Verifica autorizzazioni...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return <HydrantMap />;
}
