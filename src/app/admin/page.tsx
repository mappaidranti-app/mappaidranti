"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Hydrant } from "@/types/hydrant";
import { Download } from "lucide-react";
import OperatorsManager from "@/components/operators-manager";

type FilterType = "all" | "broken" | "missing_parts" | "maintenance";

export default function AdminEnteDashboard() {
  const [hydrants, setHydrants] = useState<Hydrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [municipalityId, setMunicipalityId] = useState<string | null>(null);
  const [municipalityName, setMunicipalityName] = useState<string>("Il tuo Comune");
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [searchComune, setSearchComune] = useState("");
  const [searchVia, setSearchVia] = useState("");
  const [searchProvincia, setSearchProvincia] = useState("");
  const [searchTipologia, setSearchTipologia] = useState("all");

  const fetchHydrants = useCallback(async (munId: string | null) => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // Proviamo a estrarre anche il nome del comune se possibile
    let query = supabase.from("hydrants").select("*, municipalities(name)").order("created_at", { ascending: false });
    
    if (munId) {
      query = query.eq("municipality_id", munId);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setHydrants(data as Hydrant[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function loadUser() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("municipality_id, role")
          .eq("id", session.user.id)
          .single();
          
        if (profile) {
          setUserRole(profile.role);
          const munScopedRoles = ["referent", "admin_ente"];
          const mId = munScopedRoles.includes(profile.role) ? profile.municipality_id : null;
          setMunicipalityId(mId);
          fetchHydrants(mId);

          if (mId) {
            const { data: mun } = await supabase.from("municipalities").select("name").eq("id", mId).single();
            if (mun && mun.name) {
              setMunicipalityName(mun.name);
            }
          }
        }
      }
    }
    loadUser();
  }, [fetchHydrants]);

  const filteredHydrants = hydrants.filter(h => {
    // Basic status filters
    if (filter === "broken" && h.status !== "Non funzionante") return false;
    if (filter === "missing_parts" && h.caps_present !== false && h.chains_present !== false) return false;
    if (filter === "maintenance" && h.pit_status !== "bloccato" && h.pit_status !== "non_ispezionabile" && h.needs_painting !== true) return false;
    
    // Advanced search filters
    if (searchVia && !(h.street || "").toLowerCase().includes(searchVia.toLowerCase())) return false;
    
    if (searchTipologia !== "all") {
      const typeStr = String(h.type || "").trim().toLowerCase();
      const isSottosuolo = typeStr === "sottosuolo";
      if (searchTipologia === "colonna" && isSottosuolo) return false;
      if (searchTipologia === "sottosuolo" && !isSottosuolo) return false;
    }

    if (searchComune) {
      const munName = (h as any).municipalities?.name?.toLowerCase() || "";
      const streetLower = (h.street || "").toLowerCase();
      if (!munName.includes(searchComune.toLowerCase()) && !streetLower.includes(searchComune.toLowerCase())) {
        return false;
      }
    }

    if (searchProvincia) {
      const streetLower = (h.street || "").toLowerCase();
      const notesLower = (h.notes || "").toLowerCase();
      if (!streetLower.includes(searchProvincia.toLowerCase()) && !notesLower.includes(searchProvincia.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  const exportToCSV = () => {
    if (filteredHydrants.length === 0) return;
    
    const headers = [
      "ID", "Codice", "Tipo", "Stato", "Condizione", "Tappi", "Catenelle", 
      "Pozzetto", "Da Verniciare", "Indirizzo", "Latitudine", "Longitudine", "Note", "Foto URL"
    ];
    
    const rows = filteredHydrants.map(h => [
      h.id,
      h.code || "",
      h.type || "",
      h.status || "",
      h.condition || "",
      h.caps_present === false ? `Mancanti (${h.caps_quantity || 0})` : "OK",
      h.chains_present === false ? `Mancanti (${h.chains_quantity || 0})` : "OK",
      h.has_pit ? (h.pit_status || "Presente") : "Assente",
      h.needs_painting ? "SI" : "NO",
      `${h.street || ""} ${h.street_number || ""}`.trim(),
      h.latitude,
      h.longitude,
      `"${(h.notes || "").replace(/"/g, '""')}"`,
      h.photo_url || ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_idranti_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Censimento Idranti</h1>
          <p className="text-slate-500 mt-1">Esporta e analizza i dati del territorio.</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredHydrants.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
        >
          <Download size={20} />
          ESPORTA CSV
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          🔍 Ricerca Avanzata
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Comune</label>
            <input 
              type="text" 
              value={searchComune}
              onChange={e => setSearchComune(e.target.value)}
              placeholder="Es. Milano..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Via / Indirizzo</label>
            <input 
              type="text" 
              value={searchVia}
              onChange={e => setSearchVia(e.target.value)}
              placeholder="Es. Via Roma..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Provincia</label>
            <input 
              type="text" 
              value={searchProvincia}
              onChange={e => setSearchProvincia(e.target.value)}
              placeholder="Es. MI..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipologia</label>
            <select
              value={searchTipologia}
              onChange={e => setSearchTipologia(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            >
              <option value="all">Tutte le Tipologie</option>
              <option value="colonna">Soprasuolo / A Colonna</option>
              <option value="sottosuolo">Sottosuolo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`px-5 py-2.5 rounded-xl font-bold border-2 transition-all ${filter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
        >
          Tutti gli Idranti
        </button>
        <button
          onClick={() => setFilter("broken")}
          className={`px-5 py-2.5 rounded-xl font-bold border-2 transition-all ${filter === "broken" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"}`}
        >
          Non Funzionanti
        </button>
        <button
          onClick={() => setFilter("missing_parts")}
          className={`px-5 py-2.5 rounded-xl font-bold border-2 transition-all ${filter === "missing_parts" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"}`}
        >
          Tappi / Catenelle Mancanti
        </button>
        <button
          onClick={() => setFilter("maintenance")}
          className={`px-5 py-2.5 rounded-xl font-bold border-2 transition-all ${filter === "maintenance" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-600 border-purple-200 hover:bg-purple-50"}`}
        >
          Pozzetto / Verniciatura
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Codice</th>
                <th className="px-6 py-4">Stato</th>
                <th className="px-6 py-4">Indirizzo</th>
                <th className="px-6 py-4">Parti Mancanti</th>
                <th className="px-6 py-4">Manutenzione</th>
                <th className="px-6 py-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-2"></div>
                    <p>Caricamento dati...</p>
                  </td>
                </tr>
              ) : filteredHydrants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Nessun idrante trovato per questo filtro.
                  </td>
                </tr>
              ) : (
                filteredHydrants.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{h.code || `ID-${h.id.substring(0, 4)}`}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${
                        h.status === "Funzionante" ? "bg-emerald-100 text-emerald-800" :
                        h.status === "Non funzionante" ? "bg-rose-100 text-rose-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{h.street} {h.street_number}</td>
                    <td className="px-6 py-4">
                      {h.caps_present === false && <span className="block text-amber-600 text-xs font-bold mb-1">Tappi: -{h.caps_quantity}</span>}
                      {h.chains_present === false && <span className="block text-amber-600 text-xs font-bold">Catene: -{h.chains_quantity}</span>}
                      {h.caps_present !== false && h.chains_present !== false && <span className="text-slate-400 text-xs">Nessuna</span>}
                    </td>
                    <td className="px-6 py-4">
                      {(h.pit_status === "bloccato" || h.pit_status === "non_ispezionabile") && <span className="block text-purple-600 text-xs font-bold mb-1">Pozzetto: {h.pit_status}</span>}
                      {h.needs_painting && <span className="block text-purple-600 text-xs font-bold">Da verniciare</span>}
                      {!((h.pit_status === "bloccato" || h.pit_status === "non_ispezionabile") || h.needs_painting) && <span className="text-slate-400 text-xs">OK</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {h.photo_url && (
                        <a href={h.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-bold text-xs underline">
                          Foto
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {userId && municipalityId && (
        <OperatorsManager 
          municipalities={[{ id: municipalityId, name: municipalityName }]} 
          referentId={userId} 
        />
      )}
    </div>
  );
}
