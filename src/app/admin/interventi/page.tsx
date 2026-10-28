"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadCsv } from "@/lib/csv";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  DUE_LABELS,
  OUTCOME_LABELS,
  formatDate,
  getDueInfo,
  type DueState,
} from "@/lib/maintenance";
import type { HydrantIntervention, HydrantStatus, InterventionCategory, InterventionOutcome } from "@/types/hydrant";

type InterventionRow = HydrantIntervention & {
  hydrants: { code: string | null; street: string | null; street_number: string | null; type: string } | null;
  municipalities: { name: string } | null;
};

type HydrantRow = {
  id: string;
  code: string | null;
  street: string | null;
  street_number: string | null;
  type: string;
  status: HydrantStatus;
  created_at: string | null;
  municipality_id: string | null;
  municipalities: { name: string } | null;
};

const MAX_ROWS = 5000;

const inputClass =
  "h-11 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-sm font-semibold focus:bg-white focus:border-blue-500 outline-none";
const labelClass = "block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1";

const address = (h: { street: string | null; street_number: string | null } | null) =>
  h ? [h.street, h.street_number].filter(Boolean).join(" ") : "";

export default function RegistroInterventiPage() {
  const [tab, setTab] = useState<"registro" | "scadenze">("registro");
  const [interventions, setInterventions] = useState<InterventionRow[]>([]);
  const [hydrants, setHydrants] = useState<HydrantRow[]>([]);
  const [codeDescriptions, setCodeDescriptions] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtri registro
  const [fComune, setFComune] = useState("all");
  const [fCategory, setFCategory] = useState<InterventionCategory | "all">("all");
  const [fOutcome, setFOutcome] = useState<InterventionOutcome | "all">("all");
  const [fCode, setFCode] = useState("");
  const [fHydrant, setFHydrant] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  // Filtri scadenzario
  const [fDue, setFDue] = useState<DueState | "all">("scaduta");

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Admin di comune e referenti di comune vedono solo il proprio comune
      const { data: profile } = await supabase.from("profiles").select("role, municipality_id").eq("id", session.user.id).single();
      const scopedMunicipality =
        profile && ["admin_ente", "referent"].includes(profile.role) ? (profile.municipality_id as string | null) : null;

      let interventionsQuery = supabase
        .from("hydrant_interventions")
        .select("*, hydrants(code, street, street_number, type), municipalities(name)")
        .order("performed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      let hydrantsQuery = supabase
        .from("hydrants")
        .select("id, code, street, street_number, type, status, created_at, municipality_id, municipalities(name)")
        .limit(MAX_ROWS);
      if (scopedMunicipality) {
        interventionsQuery = interventionsQuery.eq("municipality_id", scopedMunicipality);
        hydrantsQuery = hydrantsQuery.eq("municipality_id", scopedMunicipality);
      }

      const [intRes, hydRes, codesRes] = await Promise.all([
        interventionsQuery,
        hydrantsQuery,
        supabase.from("intervention_codes").select("code, description"),
      ]);

      if (intRes.error) {
        setLoadError(
          intRes.error.message.includes("does not exist")
            ? "Registro manutenzione non ancora attivo: va eseguita la migration add_maintenance_register.sql su Supabase."
            : intRes.error.message,
        );
      } else {
        setInterventions((intRes.data ?? []) as unknown as InterventionRow[]);
      }
      setHydrants((hydRes.data ?? []) as unknown as HydrantRow[]);
      setCodeDescriptions(new Map((codesRes.data ?? []).map((c) => [c.code as string, c.description as string])));
      setLoading(false);
    }
    load();
  }, []);

  const comuni = useMemo(() => {
    const names = new Set<string>();
    hydrants.forEach((h) => h.municipalities?.name && names.add(h.municipalities.name));
    interventions.forEach((i) => i.municipalities?.name && names.add(i.municipalities.name));
    return [...names].sort((a, b) => a.localeCompare(b, "it"));
  }, [hydrants, interventions]);

  // ── Registro ───────────────────────────────────────────────────────────
  const filteredInterventions = useMemo(() => {
    const code = fCode.trim().toLowerCase();
    const hyd = fHydrant.trim().toLowerCase();
    return interventions.filter((i) => {
      if (fComune !== "all" && (i.municipalities?.name ?? "") !== fComune) return false;
      if (fCategory !== "all" && i.category !== fCategory) return false;
      if (fOutcome !== "all" && i.outcome !== fOutcome) return false;
      if (fFrom && i.performed_at < fFrom) return false;
      if (fTo && i.performed_at > fTo) return false;
      if (code) {
        const desc = i.code ? codeDescriptions.get(i.code) ?? "" : "";
        if (!(i.code ?? "").toLowerCase().includes(code) && !desc.toLowerCase().includes(code)) return false;
      }
      if (hyd) {
        const text = `${i.hydrants?.code ?? ""} ${address(i.hydrants)}`.toLowerCase();
        if (!text.includes(hyd)) return false;
      }
      return true;
    });
  }, [interventions, fComune, fCategory, fOutcome, fFrom, fTo, fCode, fHydrant, codeDescriptions]);

  // ── Scadenzario ────────────────────────────────────────────────────────
  const dueRows = useMemo(() => {
    const lastByHydrant = new Map<string, string>();
    for (const i of interventions) {
      if (i.category !== "verifica") continue;
      const prev = lastByHydrant.get(i.hydrant_id);
      if (!prev || i.performed_at > prev) lastByHydrant.set(i.hydrant_id, i.performed_at);
    }
    return hydrants
      .map((h) => ({ hydrant: h, due: getDueInfo(lastByHydrant.get(h.id) ?? null, h.created_at) }))
      .filter((r) => r.due !== null)
      .sort((a, b) => a.due!.daysLeft - b.due!.daysLeft);
  }, [hydrants, interventions]);

  const dueCounts = useMemo(() => {
    const c: Record<DueState, number> = { scaduta: 0, in_scadenza: 0, in_regola: 0 };
    dueRows.forEach((r) => c[r.due!.state]++);
    return c;
  }, [dueRows]);

  const filteredDue = dueRows.filter(
    (r) => (fDue === "all" || r.due!.state === fDue) && (fComune === "all" || (r.hydrant.municipalities?.name ?? "") === fComune),
  );

  function exportRegistro() {
    downloadCsv(
      `registro_interventi_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Comune", "Idrante", "Indirizzo", "Tipo intervento", "Codice", "Descrizione codice", "Esito", "Acqua", "Pressione (bar)", "Quantità", "Eseguito da", "Stato dopo", "Note", "Registrato da", "Foto"],
      filteredInterventions.map((i) => [
        formatDate(i.performed_at),
        i.municipalities?.name ?? "",
        i.hydrants?.code ?? "",
        address(i.hydrants),
        CATEGORY_LABELS[i.category],
        i.code ?? "",
        i.code ? codeDescriptions.get(i.code) ?? "" : "",
        i.outcome ?? "",
        i.water_ok === null ? "" : i.water_ok ? "SI" : "NO",
        i.pressure_bar ?? "",
        i.quantity ?? "",
        i.performed_by ?? "",
        i.status_after ?? "",
        i.notes ?? "",
        i.created_by_name ?? "",
        i.photo_url ?? "",
      ]),
    );
  }

  function exportScadenze() {
    downloadCsv(
      `scadenzario_verifiche_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Idrante", "Comune", "Indirizzo", "Tipo", "Stato", "Ultimo controllo", "Prossima verifica", "Giorni", "Situazione"],
      filteredDue.map(({ hydrant: h, due }) => [
        h.code ?? "",
        h.municipalities?.name ?? "",
        address(h),
        h.type,
        h.status,
        formatDate(due!.lastCheck) + (due!.fromCensus ? " (censimento)" : ""),
        formatDate(due!.nextDue),
        due!.daysLeft,
        DUE_LABELS[due!.state].replace(/^\S+\s/, ""),
      ]),
    );
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition ${active ? "bg-slate-800 text-white shadow" : "text-slate-600 hover:bg-slate-200"}`;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800">REGISTRO INTERVENTI</h1>
        <p className="text-slate-500 mt-1">Storico della manutenzione e scadenze delle verifiche semestrali.</p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab("registro")} className={tabClass(tab === "registro")}>
          🛠️ Interventi ({interventions.length})
        </button>
        <button type="button" onClick={() => setTab("scadenze")} className={tabClass(tab === "scadenze")}>
          ⏳ Scadenzario {dueCounts.scaduta > 0 ? `(${dueCounts.scaduta} scadute)` : ""}
        </button>
      </div>

      {loadError && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{loadError}</p>}

      {loading ? (
        <p className="py-12 text-center text-slate-500">Caricamento...</p>
      ) : tab === "registro" ? (
        <>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Comune</label>
                <select value={fComune} onChange={(e) => setFComune(e.target.value)} className={inputClass}>
                  <option value="all">Tutti i comuni</option>
                  {comuni.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo intervento</label>
                <select value={fCategory} onChange={(e) => setFCategory(e.target.value as InterventionCategory | "all")} className={inputClass}>
                  <option value="all">Tutti i tipi</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Esito</label>
                <select value={fOutcome} onChange={(e) => setFOutcome(e.target.value as InterventionOutcome | "all")} className={inputClass}>
                  <option value="all">Tutti gli esiti</option>
                  {(Object.keys(OUTCOME_LABELS) as InterventionOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Codice</label>
                <input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="Codice o descrizione" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Idrante</label>
                <input value={fHydrant} onChange={(e) => setFHydrant(e.target.value)} placeholder="Codice o via" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Dal</label>
                <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Al</label>
                <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={inputClass} />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={exportRegistro}
                  disabled={filteredInterventions.length === 0}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Download size={18} /> Esporta ({filteredInterventions.length})
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">DATA</th>
                  <th className="px-4 py-3">COMUNE</th>
                  <th className="px-4 py-3">IDRANTE</th>
                  <th className="px-4 py-3">INTERVENTO</th>
                  <th className="px-4 py-3">ESITO / MISURE</th>
                  <th className="px-4 py-3">ESEGUITO DA</th>
                  <th className="px-4 py-3">NOTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInterventions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center font-medium text-slate-500">
                      {interventions.length === 0 ? "Nessun intervento registrato." : "Nessun intervento per questi filtri."}
                    </td>
                  </tr>
                ) : (
                  filteredInterventions.map((i) => (
                    <tr key={i.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{formatDate(i.performed_at)}</td>
                      <td className="px-4 py-3">{i.municipalities?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{i.hydrants?.code ?? "—"}</span>
                        <span className="block text-xs">{address(i.hydrants)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{CATEGORY_ICONS[i.category]} {CATEGORY_LABELS[i.category]}</span>
                        {i.code && (
                          <span className="block text-xs">
                            <span className="font-mono font-bold">{i.code}</span>
                            {codeDescriptions.get(i.code) ? ` – ${codeDescriptions.get(i.code)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold space-y-0.5">
                        {i.outcome && <span className="block">{OUTCOME_LABELS[i.outcome]}</span>}
                        {i.water_ok !== null && <span className="block">{i.water_ok ? "💧 Acqua OK" : "🚱 Acqua non arriva"}</span>}
                        {i.pressure_bar !== null && <span className="block">⏱️ {i.pressure_bar} bar</span>}
                        {i.quantity !== null && <span className="block">Quantità: {i.quantity}</span>}
                        {i.status_after && <span className="block">Stato → {i.status_after}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {i.performed_by ?? "—"}
                        {i.created_by_name && <span className="block text-slate-400">reg. {i.created_by_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs whitespace-pre-wrap">
                        {i.notes}
                        {i.photo_url && (
                          <a href={i.photo_url} target="_blank" rel="noopener noreferrer" className="block font-bold text-blue-600 underline">📷 Foto</a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {interventions.length >= MAX_ROWS && (
              <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Mostrati i {MAX_ROWS} interventi più recenti.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              {([
                { key: "scaduta", cls: "border-rose-300 bg-rose-50 text-rose-800" },
                { key: "in_scadenza", cls: "border-amber-300 bg-amber-50 text-amber-800" },
                { key: "in_regola", cls: "border-emerald-300 bg-emerald-50 text-emerald-800" },
                { key: "all", cls: "border-slate-300 bg-slate-50 text-slate-800" },
              ] as const).map(({ key, cls }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFDue(key)}
                  className={`rounded-xl border-2 px-4 py-3 text-left font-black transition ${cls} ${fDue === key ? "ring-2 ring-offset-2 ring-slate-800" : "opacity-80 hover:opacity-100"}`}
                >
                  <span className="block text-sm">{key === "all" ? "📋 Tutti" : DUE_LABELS[key]}</span>
                  <span className="text-2xl">{key === "all" ? dueRows.length : dueCounts[key]}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-64">
                <label className={labelClass}>Comune</label>
                <select value={fComune} onChange={(e) => setFComune(e.target.value)} className={inputClass}>
                  <option value="all">Tutti i comuni</option>
                  {comuni.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={exportScadenze}
                disabled={filteredDue.length === 0}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Download size={18} /> Esporta ({filteredDue.length})
              </button>
            </div>
            <p className="text-xs text-slate-500">
              La verifica va ripetuta ogni 6 mesi. Se un idrante non ha ancora verifiche registrate, vale la data del censimento.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">IDRANTE</th>
                  <th className="px-4 py-3">COMUNE</th>
                  <th className="px-4 py-3">STATO</th>
                  <th className="px-4 py-3">ULTIMO CONTROLLO</th>
                  <th className="px-4 py-3">PROSSIMA VERIFICA</th>
                  <th className="px-4 py-3">SITUAZIONE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center font-medium text-slate-500">Nessun idrante in questa situazione.</td>
                  </tr>
                ) : (
                  filteredDue.map(({ hydrant: h, due }) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{h.code ?? "—"}</span>
                        <span className="block text-xs">{address(h)}</span>
                      </td>
                      <td className="px-4 py-3">{h.municipalities?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-bold">{h.status}</td>
                      <td className="px-4 py-3 text-xs">
                        {formatDate(due!.lastCheck)}
                        {due!.fromCensus && <span className="block text-slate-400">censimento</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatDate(due!.nextDue)}</td>
                      <td className="px-4 py-3 text-xs font-black">
                        {DUE_LABELS[due!.state]}
                        <span className="block font-semibold text-slate-500">
                          {due!.daysLeft < 0 ? `da ${-due!.daysLeft} giorni` : `tra ${due!.daysLeft} giorni`}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
