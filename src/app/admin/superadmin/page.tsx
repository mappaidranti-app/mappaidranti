"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  createMunicipalityAndAdmin,
  getDashboardData,
} from "@/app/admin/actions";
import OperatorsManager from "@/components/operators-manager";

type Municipality = {
  id: string;
  name: string;
  contact_name: string;
  province?: string;
  notes?: string;
  ref1_name?: string;
  ref1_role?: string;
  ref1_phone?: string;
  ref1_email?: string;
  ref2_name?: string;
  ref2_role?: string;
  ref2_phone?: string;
  ref2_email?: string;
};

type Feedback = { type: "success" | "error"; text: string } | null;

// ---------------------------------------------------------------------------
// Componente: form atomico 4 campi – Crea Comune + Admin Ente
// ---------------------------------------------------------------------------
function CreateMunicipalityForm({
  onCreated,
}: {
  onCreated: (m: Municipality) => void;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);

  const [municipalityName, setMunicipalityName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const isDirty = municipalityName || adminFullName || adminEmail || adminPassword;

  const reset = () => {
    setMunicipalityName("");
    setAdminFullName("");
    setAdminEmail("");
    setAdminPassword("");
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!municipalityName.trim()) {
      setFeedback({ type: "error", text: "Il nome del Comune è obbligatorio." });
      nameRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append("municipalityName", municipalityName.trim());
      fd.append("adminFullName", adminFullName.trim());
      fd.append("adminEmail", adminEmail.trim());
      fd.append("adminPassword", adminPassword);

      const result = await createMunicipalityAndAdmin(fd);

      if (!result.success) {
        setFeedback({ type: "error", text: result.error ?? "Errore sconosciuto." });
        return;
      }

      setFeedback({ type: "success", text: "Ente e Admin creati con successo!" });
      onCreated(result.municipality as Municipality);
      reset();
      router.refresh();
    } catch (err) {
      console.error("Errore imprevisto:", err);
      setFeedback({ type: "error", text: "Errore di rete imprevisto. Riprova." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-1">Crea Nuovo Ente</h2>
      <p className="text-xs text-slate-500 mb-5">
        Compila tutti i campi per creare contestualmente il Comune e il suo Admin Ente.
      </p>

      {feedback && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 mb-5 text-sm font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          <span>{feedback.type === "success" ? "✓" : "✕"}</span>
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome Comune */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome Comune <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameRef}
              required
              type="text"
              value={municipalityName}
              onChange={(e) => setMunicipalityName(e.target.value)}
              placeholder="es. Milano"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          {/* Nome e Cognome Responsabile Admin */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome e Cognome Responsabile Admin <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="text"
              value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)}
              placeholder="es. Mario Rossi"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          {/* Email Istituzionale / Login */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Istituzionale / Login <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="es. admin@comune.milano.it"
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          {/* Password Iniziale */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Password Iniziale <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Minimo 6 caratteri"
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-all text-sm disabled:opacity-50"
          >
            {submitting ? "Creazione in corso..." : "Crea e Attiva Ente"}
          </button>
          {isDirty && !submitting && (
            <button
              type="button"
              onClick={reset}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Svuota
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina principale
// ---------------------------------------------------------------------------
export default function SuperAdminPage() {
  const router = useRouter();
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const result = await getDashboardData(session.user.id);
      if (result.isSuperAdmin) {
        setMunicipalities((result.municipalities as Municipality[]) || []);
        setReferentId(session.user.id);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Caricamento...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-800">Pannello Super Admin</h1>
        <p className="text-slate-500 text-sm mt-1">{municipalities.length} comuni registrati</p>
      </div>

      {/* Creazione Comune */}
      <CreateMunicipalityForm
        onCreated={(m) => setMunicipalities((prev) => [...prev, m])}
      />

      {/* Lista Comuni */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Comuni Registrati</h2>
        {municipalities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {municipalities.map((m) => (
              <div key={m.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-base">
                    {m.name}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">Admin Ente: {m.contact_name || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm font-medium">Nessun comune registrato.</p>
          </div>
        )}
      </div>

      {referentId && <OperatorsManager municipalities={municipalities} referentId={referentId} />}
    </div>
  );
}
