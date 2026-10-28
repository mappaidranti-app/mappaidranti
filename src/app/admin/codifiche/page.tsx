"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { getAccessToken, supabase } from "@/lib/supabase";
import { importInterventionCodes } from "@/app/admin/actions";
import type { InterventionCode } from "@/types/hydrant";

type ParsedRow = { code: string; description: string; category: string | null };

/**
 * Legge le righe incollate da Excel (separate da tabulazione) o un file CSV (; oppure ,).
 * Colonne: codice, descrizione, categoria (facoltativa). La riga di intestazione viene saltata.
 */
function parseCodes(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const first = lines[0];
  const sep = first.includes("\t") ? "\t" : first.split(";").length >= first.split(",").length ? ";" : ",";

  const splitLine = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        cells.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const rows = lines.map(splitLine);
  const looksLikeHeader = /cod/i.test(rows[0][0] ?? "") && /desc/i.test(rows[0][1] ?? "");
  return (looksLikeHeader ? rows.slice(1) : rows)
    .filter((r) => r[0] && r[1])
    .map((r) => ({ code: r[0], description: r[1], category: r[2] || null }));
}

export default function CodifichePage() {
  const [codes, setCodes] = useState<InterventionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("intervention_codes").select("code, description, category, is_active").order("code");
    if (error) {
      setLoadError(
        error.message.includes("does not exist")
          ? "Tabella codifiche non ancora presente: va eseguita la migration add_maintenance_register.sql su Supabase."
          : error.message,
      );
    } else {
      setLoadError(null);
      setCodes((data ?? []) as InterventionCode[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parsed = useMemo(() => parseCodes(text), [text]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter((c) => [c.code, c.description, c.category ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [codes, search]);

  async function handleImport() {
    setImporting(true);
    setResult(null);
    const token = await getAccessToken();
    const res = await importInterventionCodes(token ?? "", parsed);
    if ("error" in res && res.error) {
      setResult({ ok: false, message: res.error });
    } else if ("imported" in res) {
      setResult({
        ok: true,
        message: `Importate ${res.imported} codifiche${res.skipped ? ` (${res.skipped} righe scartate o doppie)` : ""}.`,
      });
      setText("");
      load();
    }
    setImporting(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800">CODIFICHE INTERVENTO</h1>
        <p className="text-slate-500 mt-1">Elenco dei codici usati nel registro manutenzione.</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">📥 Importa da Excel</h2>
        <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
          <li>In Excel seleziona le colonne <strong>Codice</strong>, <strong>Descrizione</strong> e, se c&apos;è, <strong>Categoria</strong> (anche con la riga di intestazione).</li>
          <li>Copia (Ctrl+C) e incolla qui sotto (Ctrl+V). In alternativa carica il file salvato come CSV.</li>
          <li>Controlla l&apos;anteprima e premi Importa. I codici già presenti vengono aggiornati.</li>
        </ol>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"Codice\tDescrizione\tCategoria\nV01\tVerifica semestrale colonna\tverifica"}
          className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 p-3 font-mono text-sm focus:bg-white focus:border-blue-500 outline-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Carica file CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsed.length === 0 || importing}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Importa {parsed.length > 0 ? `${parsed.length} codifiche` : ""}
          </button>
        </div>
        {parsed.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <p className="bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-500">Anteprima (prime 5 righe)</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {parsed.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono font-bold">{r.code}</td>
                    <td className="px-3 py-1.5">{r.description}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.category ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <p className={`rounded-xl p-3 text-sm font-semibold ${result.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
            {result.message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-black text-slate-800 uppercase">Codifiche presenti: {codes.length}</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca codice o descrizione..."
            className="h-10 w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        {loading ? (
          <p className="p-6 text-center text-slate-500">Caricamento...</p>
        ) : loadError ? (
          <p className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-slate-500">{codes.length === 0 ? "Nessuna codifica caricata." : "Nessun risultato."}</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">CODICE</th>
                  <th className="px-5 py-3">DESCRIZIONE</th>
                  <th className="px-5 py-3">CATEGORIA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.code}>
                    <td className="px-5 py-2.5 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="px-5 py-2.5">{c.description}</td>
                    <td className="px-5 py-2.5 text-slate-500">{c.category ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
