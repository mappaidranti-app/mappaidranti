"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Municipality = {
  id: string;
  name: string;
  contact_name: string;
  operators_count: number;
  created_at: string;
};

export default function AdminPage() {
  const [data, setData] = useState<Municipality | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        router.push("/login");
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Recupera il profilo dell'utente loggato
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, municipality_id")
          .eq("id", session.user.id)
          .single();

        // Se non è referente, lo rimanda alla mappa pubblica
        if (profileError || profile?.role !== "referent") {
          router.push("/");
          return;
        }

        // Se è referente, cerchiamo il suo comune
        let query = supabase.from("municipalities").select("*");
        if (profile?.municipality_id) {
          query = query.eq("id", profile.municipality_id).limit(1);
        } else {
          query = query.limit(1); // fallback
        }

        const { data: municipalities, error } = await query;

        if (!error && municipalities && municipalities.length > 0) {
          setData(municipalities[0]);
        }
      } catch (err) {
        console.error("Errore nel recupero dati:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex justify-center items-start pt-12 md:pt-20">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Gestione Progetto</h1>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-sm text-gray-500">Caricamento dati...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-sm text-gray-500 font-medium mb-1">Comune</p>
              <p className="text-xl font-bold text-gray-900">{data.name}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-sm text-gray-500 font-medium mb-1">Funzionario Referente</p>
              <p className="text-lg font-semibold text-gray-900">{data.contact_name || "Non specificato"}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Operatori Autorizzati</p>
                <p className="text-lg font-semibold text-gray-900">{data.operators_count ?? 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Nessun dato anagrafico presente.</p>
            <p className="text-sm text-gray-400 mt-2">Aggiungi i dati nella tabella municipalities.</p>
          </div>
        )}
      </div>
    </div>
  );
}
