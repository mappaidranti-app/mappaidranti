"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Hydrant, HydrantCondition } from "@/types/hydrant";
import { Download } from "lucide-react";
import OperatorsManager from "@/components/operators-manager";

type FilterType =
  | "all"
  | "working"
  | "broken"
  | "to_verify"
  | "missing_caps"
  | "missing_chains"
  | "needs_painting"
  | "accessible"
  | "has_pit"
  | "cond_nuovo"
  | "cond_discreto"
  | "cond_sufficiente"
  | "cond_pessimo";

const FILTER_BUTTONS: { key: FilterType; label: string; colorActive: string; colorInactive: string }[] = [
  { key: "all", label: "TUTTI GLI IDRANTI", colorActive: "bg-slate-800 text-white border-slate-800", colorInactive: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50" },
  { key: "working", label: "✅ FUNZIONANTI", colorActive: "bg-emerald-600 text-white border-emerald-600", colorInactive: "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
  { key: "broken", label: "❌ NON FUNZIONANTI", colorActive: "bg-rose-600 text-white border-rose-600", colorInactive: "bg-white text-rose-700 border-rose-300 hover:bg-rose-50" },
  { key: "to_verify", label: "⚠️ DA VERIFICARE", colorActive: "bg-amber-500 text-white border-amber-500", colorInactive: "bg-white text-amber-700 border-amber-300 hover:bg-amber-50" },
  { key: "missing_caps", label: "🔴 TAPPI MANCANTI", colorActive: "bg-orange-600 text-white border-orange-600", colorInactive: "bg-white text-orange-700 border-orange-300 hover:bg-orange-50" },
  { key: "missing_chains", label: "🔗 CATENELLE MANCANTI", colorActive: "bg-orange-600 text-white border-orange-600", colorInactive: "bg-white text-orange-700 border-orange-300 hover:bg-orange-50" },
  { key: "needs_painting", label: "🎨 DA VERNICIARE", colorActive: "bg-purple-600 text-white border-purple-600", colorInactive: "bg-white text-purple-700 border-purple-300 hover:bg-purple-50" },
  { key: "accessible", label: "🚒 ACCESSIBILE A TUTTI I MEZZI", colorActive: "bg-teal-600 text-white border-teal-600", colorInactive: "bg-white text-teal-700 border-teal-300 hover:bg-teal-50" },
  { key: "has_pit", label: "🕳️ PRESENZA POZZETTO", colorActive: "bg-indigo-600 text-white border-indigo-600", colorInactive: "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50" },
];

const CONDITION_BUTTONS: { key: FilterType; label: string }[] = [
  { key: "cond_nuovo", label: "NUOVO" },
  { key: "cond_discreto", label: "DISCRETO" },
  { key: "cond_sufficiente", label: "SUFFICIENTE" },
  { key: "cond_pessimo", label: "PESSIMO / DANNEGGIATO" },
];

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
  const [searchTipologia, setSearchTipologia] = useState("all");

  const fetchHydrants = useCallback(async (munId: string | null) => {
    if (!supabase) {
      setLoading(false);
      return;
    }
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
    // Status filters
    if (filter === "working" && h.status !== "Funzionante") return false;
    if (filter === "broken" && h.status !== "Non funzionante") return false;
    if (filter === "to_verify" && h.status !== "Da verificare") return false;
    
    // Parts filters
    if (filter === "missing_caps" && h.caps_present !== false) return false;
    if (filter === "missing_chains" && h.chains_present !== false) return false;
    
    // Maintenance filters
    if (filter === "needs_painting" && h.needs_painting !== true) return false;
    
    // Accessibility filter
    if (filter === "accessible") {
      const acc = (h.accessibility || "").toLowerCase();
      const isAccessible = acc.includes("tutti i mezzi") || acc.includes("camion") || acc.includes("cisterna") || acc.includes("3,5");
      if (!isAccessible) return false;
    }
    
    // Pozzetto filter
    if (filter === "has_pit" && h.has_pit !== true) return false;
    
    // Condition filters
    if (filter === "cond_nuovo" && h.condition !== "NUOVO") return false;
    if (filter === "cond_discreto" && h.condition !== "DISCRETO") return false;
    if (filter === "cond_sufficiente" && h.condition !== "SUFFICIENTE") return false;
    if (filter === "cond_pessimo" && h.condition !== "PESSIMO / DANNEGGIATO") return false;
    
    // Text search filters
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

    return true;
  });

  const exportToCSV = () => {
    if (filteredHydrants.length === 0) return;
    
    const headers = [
      "ID", "Codice", "Tipo", "Stato", "Condizione", "Tappi", "Catenelle", 
      "Pozzetto", "Stato Pozzetto", "Da Verniciare", "Accessibilita", "Indirizzo", "Latitudine", "Longitudine", "Note", "Foto URL"
    ];
    
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = filteredHydrants.map(h => [
      escapeCSV(h.id),
      escapeCSV(h.code || ""),
      escapeCSV(h.type || ""),
      escapeCSV(h.status || ""),
      escapeCSV(h.condition || ""),
      h.caps_present === false ? escapeCSV(`Mancanti (${h.caps_quantity || 0})`) : "OK",
      h.chains_present === false ? escapeCSV(`Mancanti (${h.chains_quantity || 0})`) : "OK",
      h.has_pit ? "Presente" : "Assente",
      escapeCSV(h.pit_status || ""),
      h.needs_painting ? "SI" : "NO",
      escapeCSV(h.accessibility || ""),
      escapeCSV(`${h.street || ""} ${h.street_number || ""}`.trim()),
      String(h.latitude),
      String(h.longitude),
      escapeCSV(h.notes || ""),
      escapeCSV(h.photo_url || "")
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_idranti_${filter}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Stats
  const stats = {
    total: hydrants.length,
    working: hydrants.filter(h => h.status === "Funzionante").length,
    broken: hydrants.filter(h => h.status === "Non funzionante").length,
    toVerify: hydrants.filter(h => h.status === "Da verificare").length,
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">PANNELLO DI CONTROLLO</h1>
          <p className="text-slate-500 mt-1">Censimento idranti — {municipalityName}</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredHydrants.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-black text-lg transition-all active:scale-95 disabled:opacity-50 shadow-lg"
        >
          <Download size={22} />
          📥 ESPORTA CSV ({filteredHydrants.length})
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-800 text-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-300">TOTALE</p>
          <p className="text-3xl font-black mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-emerald-600 text-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">FUNZIONANTI</p>
          <p className="text-3xl font-black mt-1">{stats.working}</p>
        </div>
        <div className="rounded-2xl bg-rose-600 text-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-200">NON FUNZIONANTI</p>
          <p className="text-3xl font-black mt-1">{stats.broken}</p>
        </div>
        <div className="rounded-2xl bg-amber-500 text-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-100">DA VERIFICARE</p>
          <p className="text-3xl font-black mt-1">{stats.toVerify}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">🔍 RICERCA AVANZATA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">COMUNE</label>
            <input 
              type="text" 
              value={searchComune}
              onChange={e => setSearchComune(e.target.value)}
              placeholder="Es. Milano..."
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 bg-slate-50 text-base font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">VIA / INDIRIZZO</label>
            <input 
              type="text" 
              value={searchVia}
              onChange={e => setSearchVia(e.target.value)}
              placeholder="Es. Via Roma..."
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 bg-slate-50 text-base font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">TIPOLOGIA</label>
            <select
              value={searchTipologia}
              onChange={e => setSearchTipologia(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 bg-slate-50 text-base font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="all">TUTTE LE TIPOLOGIE</option>
              <option value="colonna">SOPRASUOLO / A COLONNA</option>
              <option value="sottosuolo">SOTTOSUOLO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Buttons - Vertical column same width */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">📋 FILTRI STATO</h2>
        <div className="flex flex-col gap-2">
          {FILTER_BUTTONS.map(({ key, label, colorActive, colorInactive }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`w-full text-left px-6 py-4 rounded-xl font-black text-lg uppercase tracking-wide border-2 transition-all active:scale-[0.98] ${
                filter === key ? colorActive : colorInactive
              }`}
            >
              {label}
              <span className="float-right font-black text-xl">
                {key === "all" ? hydrants.length :
                 key === "working" ? hydrants.filter(h => h.status === "Funzionante").length :
                 key === "broken" ? hydrants.filter(h => h.status === "Non funzionante").length :
                 key === "to_verify" ? hydrants.filter(h => h.status === "Da verificare").length :
                 key === "missing_caps" ? hydrants.filter(h => h.caps_present === false).length :
                 key === "missing_chains" ? hydrants.filter(h => h.chains_present === false).length :
                 key === "needs_painting" ? hydrants.filter(h => h.needs_painting === true).length :
                 key === "accessible" ? hydrants.filter(h => { const a = (h.accessibility || "").toLowerCase(); return a.includes("tutti i mezzi") || a.includes("camion") || a.includes("cisterna") || a.includes("3,5"); }).length :
                 key === "has_pit" ? hydrants.filter(h => h.has_pit === true).length : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Condition Filters - Separate section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">🏗️ STATI DI CONSERVAZIONE</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {CONDITION_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`w-full px-4 py-4 rounded-xl font-black text-base uppercase tracking-wide border-2 transition-all active:scale-[0.98] ${
                filter === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              }`}
            >
              {label}
              <span className="block text-2xl mt-1">
                {hydrants.filter(h => {
                  if (key === "cond_nuovo") return h.condition === "NUOVO";
                  if (key === "cond_discreto") return h.condition === "DISCRETO";
                  if (key === "cond_sufficiente") return h.condition === "SUFFICIENTE";
                  if (key === "cond_pessimo") return h.condition === "PESSIMO / DANNEGGIATO";
                  return false;
                }).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 uppercase">
            RISULTATI: {filteredHydrants.length} IDRANTI
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">CODICE</th>
                <th className="px-6 py-4">STATO</th>
                <th className="px-6 py-4">INDIRIZZO</th>
                <th className="px-6 py-4">TAPPI</th>
                <th className="px-6 py-4">CATENE</th>
                <th className="px-6 py-4">POZZETTO</th>
                <th className="px-6 py-4">VERNICIATURA</th>
                <th className="px-6 py-4 text-right">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-2"></div>
                    <p>Caricamento dati...</p>
                  </td>
                </tr>
              ) : filteredHydrants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium">
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
                      {h.caps_present === false 
                        ? <span className="text-rose-600 text-xs font-bold">❌ -{h.caps_quantity}</span>
                        : <span className="text-emerald-600 text-xs font-bold">✅ OK</span>}
                    </td>
                    <td className="px-6 py-4">
                      {h.chains_present === false 
                        ? <span className="text-rose-600 text-xs font-bold">❌ -{h.chains_quantity}</span>
                        : <span className="text-emerald-600 text-xs font-bold">✅ OK</span>}
                    </td>
                    <td className="px-6 py-4">
                      {h.has_pit ? (
                        <div>
                          <span className="text-xs font-bold text-indigo-700">✅ Presente</span>
                          {h.pit_status && (
                            <span className={`block text-xs font-bold mt-0.5 ${
                              h.pit_status === "bloccato" ? "text-rose-600" : "text-slate-500"
                            }`}>
                              {h.pit_status === "apre_facilmente" ? "Si apre" : h.pit_status === "bloccato" ? "Bloccato" : h.pit_status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">Assente</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {h.needs_painting 
                        ? <span className="text-purple-600 text-xs font-bold">🎨 SI</span>
                        : <span className="text-slate-400 text-xs">NO</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {h.photo_url && (
                        <a href={h.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-bold text-xs underline">
                          📷 Foto
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
