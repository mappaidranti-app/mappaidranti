"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ClipboardPlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadHydrantPhoto } from "@/lib/photos";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  DUE_LABELS,
  OUTCOME_LABELS,
  formatDate,
  getDueInfo,
  isMissingTableError,
  lastVerificationDate,
  todayIso,
} from "@/lib/maintenance";
import type {
  Hydrant,
  HydrantIntervention,
  HydrantStatus,
  InterventionCategory,
  InterventionCode,
  InterventionOutcome,
} from "@/types/hydrant";

// Le codifiche cambiano raramente: si caricano una volta sola per sessione
let codesPromise: Promise<InterventionCode[]> | null = null;
export function loadInterventionCodes(): Promise<InterventionCode[]> {
  if (!supabase) return Promise.resolve([]);
  if (!codesPromise) {
    codesPromise = Promise.resolve(
      supabase.from("intervention_codes").select("code, description, category, is_active").eq("is_active", true).order("code"),
    ).then(({ data }) => (data ?? []) as InterventionCode[]);
  }
  return codesPromise;
}

const DUE_STYLES = {
  in_regola: "border-emerald-300 bg-emerald-50 text-emerald-800",
  in_scadenza: "border-amber-300 bg-amber-50 text-amber-800",
  scaduta: "border-rose-300 bg-rose-50 text-rose-800",
} as const;

type Props = {
  hydrant: Hydrant;
  userName: string | null;
  /** Gli amministratori possono cancellare voci del registro inserite per errore */
  isAdmin: boolean;
  onEdit: () => void;
  onHydrantUpdated: (hydrant: Hydrant) => void;
};

/** Scheda di dettaglio (mappa operativa): azioni, tracciabilità, scadenza verifica e storico interventi. */
export function MaintenanceSection({ hydrant, userName, isAdmin, onEdit, onHydrantUpdated }: Props) {
  const [interventions, setInterventions] = useState<HydrantIntervention[]>([]);
  const [codes, setCodes] = useState<InterventionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("hydrant_interventions")
      .select("*")
      .eq("hydrant_id", hydrant.id)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Caricamento registro interventi:", error);
      setLoadError(
        isMissingTableError(error)
          ? "Registro manutenzione non ancora attivo: va eseguita la migration add_maintenance_register.sql su Supabase."
          : `Impossibile caricare lo storico: ${error.message}`,
      );
    } else {
      setLoadError(null);
      setInterventions((data ?? []) as HydrantIntervention[]);
    }
    setLoading(false);
  }, [hydrant.id]);

  useEffect(() => {
    load();
    loadInterventionCodes().then(setCodes);
  }, [load]);

  const codeDescriptions = useMemo(() => new Map(codes.map((c) => [c.code, c.description])), [codes]);
  const due = getDueInfo(lastVerificationDate(interventions), hydrant.created_at);

  async function handleDelete(item: HydrantIntervention) {
    if (!supabase) return;
    if (!window.confirm(`Eliminare l'intervento "${CATEGORY_LABELS[item.category]}" del ${formatDate(item.performed_at)}?`)) return;
    const { error } = await supabase.from("hydrant_interventions").delete().eq("id", item.id);
    if (error) {
      alert("Eliminazione non riuscita: " + error.message);
      return;
    }
    setInterventions((current) => current.filter((i) => i.id !== item.id));
  }

  return (
    <>
      {/* Azioni */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-4 text-base font-black uppercase text-white shadow-md transition hover:bg-slate-700 active:scale-95"
        >
          <Pencil size={20} aria-hidden="true" />
          Modifica scheda
        </button>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          disabled={!!loadError}
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black uppercase text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
        >
          <ClipboardPlus size={20} aria-hidden="true" />
          Registra intervento
        </button>
      </div>

      {/* Manutenzione */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">🛠️ Manutenzione</h3>

        {due && (
          <div className={`rounded-xl border-2 p-3 ${DUE_STYLES[due.state]}`}>
            <p className="text-lg font-black">{DUE_LABELS[due.state]}</p>
            <p className="text-sm font-semibold">
              Prossima verifica entro il <strong>{formatDate(due.nextDue)}</strong>
              {due.daysLeft < 0 ? ` (scaduta da ${-due.daysLeft} giorni)` : ` (tra ${due.daysLeft} giorni)`}
            </p>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Ultimo controllo: {formatDate(due.lastCheck)}
              {due.fromCensus ? " (censimento, nessuna verifica registrata)" : ""}
            </p>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-500 space-y-0.5">
          <p>
            Censito {hydrant.created_by_name ? <>da <strong>{hydrant.created_by_name}</strong> </> : ""}il {formatDate(hydrant.created_at)}
          </p>
          {hydrant.updated_at && (
            <p>
              Ultima modifica {hydrant.updated_by_name ? <>di <strong>{hydrant.updated_by_name}</strong> </> : ""}il {formatDate(hydrant.updated_at)}
            </p>
          )}
        </div>

        <h4 className="pt-1 text-xs font-black uppercase tracking-wider text-slate-500">Storico interventi</h4>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Caricamento...
          </p>
        ) : loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{loadError}</p>
        ) : interventions.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">Nessun intervento registrato.</p>
        ) : (
          <ul className="space-y-2">
            {interventions.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900">
                      {CATEGORY_ICONS[item.category]} {CATEGORY_LABELS[item.category]}
                      <span className="ml-2 text-sm font-bold text-slate-500">{formatDate(item.performed_at)}</span>
                    </p>
                    {item.code && (
                      <p className="text-sm font-semibold text-slate-700">
                        Cod. <span className="font-mono font-black">{item.code}</span>
                        {codeDescriptions.get(item.code) ? ` – ${codeDescriptions.get(item.code)}` : ""}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Elimina intervento"
                      title="Elimina intervento"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                  {item.outcome && <span className="rounded-md bg-white px-2 py-1 border border-slate-200">{OUTCOME_LABELS[item.outcome]}</span>}
                  {item.water_ok !== null && (
                    <span className="rounded-md bg-white px-2 py-1 border border-slate-200">
                      {item.water_ok ? "💧 Acqua OK" : "🚱 Acqua non arriva"}
                    </span>
                  )}
                  {item.pressure_bar !== null && (
                    <span className="rounded-md bg-white px-2 py-1 border border-slate-200">⏱️ {item.pressure_bar} bar</span>
                  )}
                  {item.quantity !== null && (
                    <span className="rounded-md bg-white px-2 py-1 border border-slate-200">Quantità: {item.quantity}</span>
                  )}
                  {item.status_after && (
                    <span className="rounded-md bg-white px-2 py-1 border border-slate-200">Stato → {item.status_after}</span>
                  )}
                </div>
                {item.notes && <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap">{item.notes}</p>}
                {item.photo_url && (
                  <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.photo_url} alt="Foto intervento" className="h-24 w-32 rounded-lg border border-slate-200 object-cover" />
                  </a>
                )}
                <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                  {item.performed_by ? `Eseguito da ${item.performed_by}` : ""}
                  {item.performed_by && item.created_by_name ? " · " : ""}
                  {item.created_by_name ? `registrato da ${item.created_by_name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isFormOpen && (
        <InterventionForm
          hydrant={hydrant}
          userName={userName}
          codes={codes}
          onClose={() => setIsFormOpen(false)}
          onSaved={(saved, updatedHydrant) => {
            setInterventions((current) =>
              [saved, ...current].sort((a, b) => (a.performed_at === b.performed_at ? 0 : a.performed_at < b.performed_at ? 1 : -1)),
            );
            if (updatedHydrant) onHydrantUpdated(updatedHydrant);
            setIsFormOpen(false);
          }}
        />
      )}
    </>
  );
}

const OUTCOMES: InterventionOutcome[] = ["positivo", "parziale", "negativo"];
const STATUSES: HydrantStatus[] = ["Funzionante", "Da verificare", "Non funzionante"];

function InterventionForm({
  hydrant,
  userName,
  codes,
  onClose,
  onSaved,
}: {
  hydrant: Hydrant;
  userName: string | null;
  codes: InterventionCode[];
  onClose: () => void;
  onSaved: (saved: HydrantIntervention, updatedHydrant: Hydrant | null) => void;
}) {
  const [performedAt, setPerformedAt] = useState(todayIso());
  const [category, setCategory] = useState<InterventionCategory | null>(null);
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<InterventionOutcome | null>(null);
  const [waterOk, setWaterOk] = useState<boolean | null>(null);
  const [pressure, setPressure] = useState("");
  const [quantity, setQuantity] = useState("");
  const [performedBy, setPerformedBy] = useState(userName ?? "");
  const [notes, setNotes] = useState("");
  const [statusAfter, setStatusAfter] = useState<HydrantStatus | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isWaterTest = category === "prova_acqua";
  const hasQuantity = category === "tappi" || category === "catenelle";
  const codeEntry = code.trim() ? codes.find((c) => c.code.toLowerCase() === code.trim().toLowerCase()) : null;

  async function handleSave() {
    if (!supabase || !category) return;
    if (code.trim() && codes.length > 0 && !codeEntry) {
      setError(`Il codice "${code.trim()}" non è tra le codifiche: sceglilo dall'elenco o lascia il campo vuoto.`);
      return;
    }
    const pressureValue = pressure.trim() ? Number(pressure.replace(",", ".")) : null;
    if (pressureValue !== null && (Number.isNaN(pressureValue) || pressureValue < 0 || pressureValue >= 100)) {
      setError("La pressione deve essere un numero in bar (es. 3,5).");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const photoUrl = photo ? await uploadHydrantPhoto(photo, "foto dell'intervento") : null;

      const { data: saved, error: insertError } = await supabase
        .from("hydrant_interventions")
        .insert({
          hydrant_id: hydrant.id,
          performed_at: performedAt,
          category,
          code: codeEntry?.code ?? null,
          outcome,
          water_ok: isWaterTest ? waterOk : null,
          pressure_bar: isWaterTest ? pressureValue : null,
          quantity: hasQuantity && quantity.trim() ? Number(quantity) : null,
          performed_by: performedBy.trim() || null,
          notes: notes.trim() || null,
          photo_url: photoUrl,
          status_after: statusAfter || null,
          created_by_name: userName,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);

      // Se è stato indicato un nuovo stato, si aggiorna anche la scheda dell'idrante
      let updatedHydrant: Hydrant | null = null;
      if (statusAfter && statusAfter !== hydrant.status) {
        const { data, error: updateError } = await supabase
          .from("hydrants")
          .update({ status: statusAfter, updated_by_name: userName })
          .eq("id", hydrant.id)
          .select("*")
          .single();
        if (updateError) {
          alert(`Intervento registrato, ma lo stato dell'idrante non è stato aggiornato: ${updateError.message}`);
        } else {
          updatedHydrant = data as Hydrant;
        }
      }

      onSaved(saved as HydrantIntervention, updatedHydrant);
    } catch (err) {
      setError("Salvataggio non riuscito: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-xl border-2 px-3 py-3 text-sm font-black transition active:scale-95 ${
      active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
    }`;

  // Portale su <body>: la scheda di dettaglio crea un proprio livello e terrebbe il modulo sotto la barra in alto
  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/40 md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-slate-50 shadow-2xl md:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 rounded-t-3xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registro manutenzione</p>
            <h2 className="text-lg font-black text-slate-900">
              Nuovo intervento {hydrant.code ? `– idrante ${hydrant.code}` : ""}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Chiudi">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
          <section>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Tipo di intervento *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
                  {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section>
              <label htmlFor="int-date" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Data *</label>
              <input
                id="int-date"
                type="date"
                value={performedAt}
                max={todayIso()}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
              />
            </section>
            <section>
              <label htmlFor="int-code" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Codice intervento</label>
              {codes.length > 0 ? (
                <>
                  <input
                    id="int-code"
                    list="intervention-codes"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Scrivi codice o descrizione..."
                    className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
                  />
                  <datalist id="intervention-codes">
                    {codes.map((c) => (
                      <option key={c.code} value={c.code}>{c.description}</option>
                    ))}
                  </datalist>
                  {codeEntry && <p className="mt-1 text-xs font-semibold text-emerald-700">✓ {codeEntry.description}</p>}
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-500">
                  Le codifiche non sono ancora state caricate.
                </p>
              )}
            </section>
          </div>

          {isWaterTest && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
              <section>
                <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-blue-800">Arriva acqua?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setWaterOk(true)} className={chip(waterOk === true)}>💧 SÌ</button>
                  <button type="button" onClick={() => setWaterOk(false)} className={chip(waterOk === false)}>🚱 NO</button>
                </div>
              </section>
              <section>
                <label htmlFor="int-pressure" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-blue-800">Pressione (bar)</label>
                <input
                  id="int-pressure"
                  inputMode="decimal"
                  value={pressure}
                  onChange={(e) => setPressure(e.target.value)}
                  placeholder="es. 3,5"
                  className="h-12 w-full rounded-xl border-2 border-blue-300 bg-white px-3 text-base font-semibold"
                />
              </section>
            </div>
          )}

          {hasQuantity && (
            <section>
              <label htmlFor="int-qty" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
                {category === "tappi" ? "Tappi montati" : "Catenelle montate"}
              </label>
              <input
                id="int-qty"
                type="number"
                min={0}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12 w-32 rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
              />
            </section>
          )}

          <section>
            <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-slate-500">Esito</p>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((o) => (
                <button key={o} type="button" onClick={() => setOutcome(outcome === o ? null : o)} className={chip(outcome === o)}>
                  {OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="int-by" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Eseguito da</label>
            <input
              id="int-by"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="Operatore o ditta (con codice)"
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
            />
          </section>

          <section>
            <label htmlFor="int-status" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">
              Stato dell&apos;idrante dopo l&apos;intervento
            </label>
            <select
              id="int-status"
              value={statusAfter}
              onChange={(e) => setStatusAfter(e.target.value as HydrantStatus | "")}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-semibold"
            >
              <option value="">Non cambia (ora: {hydrant.status})</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </section>

          <section>
            <label htmlFor="int-notes" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Note</label>
            <textarea
              id="int-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base"
            />
          </section>

          <section>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-black text-slate-700 hover:bg-slate-100"
            >
              <Camera size={20} aria-hidden="true" />
              {photo ? `✓ Foto pronta (${photo.name}) – cambia` : "Foto dell'intervento (facoltativa)"}
            </button>
          </section>

          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!category || !performedAt || isSaving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-black text-white shadow-lg disabled:opacity-50 disabled:grayscale"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : null}
            {isSaving ? "Salvataggio..." : category ? "✅ REGISTRA INTERVENTO" : "Scegli il tipo di intervento"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
