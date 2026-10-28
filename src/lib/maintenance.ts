import type { HydrantIntervention, InterventionCategory, InterventionOutcome } from "@/types/hydrant";

export const CATEGORY_LABELS: Record<InterventionCategory, string> = {
  verifica: "Verifica periodica",
  prova_acqua: "Prova acqua",
  verniciatura: "Verniciatura",
  tappi: "Montaggio tappi",
  catenelle: "Montaggio catenelle",
  riparazione: "Riparazione",
  altro: "Altro intervento",
};

export const CATEGORY_ICONS: Record<InterventionCategory, string> = {
  verifica: "🔍",
  prova_acqua: "💧",
  verniciatura: "🎨",
  tappi: "🔴",
  catenelle: "🔗",
  riparazione: "🔧",
  altro: "📝",
};

export const OUTCOME_LABELS: Record<InterventionOutcome, string> = {
  positivo: "✅ Positivo",
  parziale: "⚠️ Parziale",
  negativo: "❌ Negativo",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as InterventionCategory[];

/** Gli idranti vanno controllati ogni 6 mesi */
export const VERIFICATION_INTERVAL_MONTHS = 6;
/** "In scadenza" quando mancano meno di 30 giorni */
export const DUE_SOON_DAYS = 30;
/** Interventi che valgono come controllo periodico */
const VERIFICATION_CATEGORIES: InterventionCategory[] = ["verifica"];

export type DueState = "in_regola" | "in_scadenza" | "scaduta";

export type DueInfo = {
  state: DueState;
  /** Data dell'ultimo controllo (verifica periodica o, in mancanza, censimento) */
  lastCheck: Date;
  /** true se l'ultimo controllo è il censimento e non una verifica registrata */
  fromCensus: boolean;
  nextDue: Date;
  /** Giorni alla scadenza (negativi = scaduta da N giorni) */
  daysLeft: number;
};

export const DUE_LABELS: Record<DueState, string> = {
  in_regola: "✅ In regola",
  in_scadenza: "⏳ In scadenza",
  scaduta: "⛔ Verifica scaduta",
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Data dell'ultima verifica periodica tra gli interventi indicati (che possono essere di più idranti). */
export function lastVerificationDate(interventions: Pick<HydrantIntervention, "category" | "performed_at">[]) {
  let last: string | null = null;
  for (const i of interventions) {
    if (VERIFICATION_CATEGORIES.includes(i.category) && (!last || i.performed_at > last)) last = i.performed_at;
  }
  return last;
}

/**
 * Scadenza della prossima verifica: 6 mesi dall'ultima verifica registrata.
 * Se non ce ne sono, il censimento vale come primo controllo.
 */
export function getDueInfo(lastVerification: string | null, censusDate: string | null | undefined, today = new Date()): DueInfo | null {
  const base = lastVerification ?? censusDate ?? null;
  if (!base) return null;
  const lastCheck = new Date(base.length === 10 ? `${base}T00:00:00` : base);
  const nextDue = addMonths(lastCheck, VERIFICATION_INTERVAL_MONTHS);
  const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / 86_400_000);
  const state: DueState = daysLeft < 0 ? "scaduta" : daysLeft <= DUE_SOON_DAYS ? "in_scadenza" : "in_regola";
  return { state, lastCheck, fromCensus: !lastVerification, nextDue, daysLeft };
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Data di oggi nel formato del campo date (YYYY-MM-DD), ora locale */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
