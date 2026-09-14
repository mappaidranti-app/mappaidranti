"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  createMunicipalitySimple,
  getDashboardData,
  updateMunicipality,
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
// Componente: form minimo per la creazione di un Comune
// ---------------------------------------------------------------------------
function CreateMunicipalityForm({
  onCreated,
}: {
  onCreated: (m: Municipality) => void;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");
  const [istatCode, setIstatCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const reset = () => {
    setName("");
    setProvince("");
    setIstatCode("");
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: "error", text: "Il nome del Comune e obbligatorio." });
      nameRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("province", province.trim());
      fd.append("istatCode", istatCode.trim());

      const result = await createMunicipalitySimple(fd);

      if (!result.success) {
        setFeedback({ type: "error", text: result.error ?? "Errore sconosciuto." });
        return;
      }

      setFeedback({ type: "success", text: `Comune "${name.trim()}" creato con successo!` });
      onCreated(result.data as Municipality);
      setName("");
      setProvince("");
      setIstatCode("");
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
      <h2 className="text-lg font-bold text-slate-800 mb-1">Crea Nuovo Comune</h2>
      <p className="text-xs text-slate-500 mb-5">
        Inserisci solo i dati identificativi del Comune. Potrai assegnare un Admin Ente in un secondo momento.
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
          <span>{feedback.type === "success" ? "v" : "x"}</span>
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome Comune <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameRef}
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Milano"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
            <input
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="es. MI"
              maxLength={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Codice ISTAT</label>
            <input
              type="text"
              value={istatCode}
              onChange={(e) => setIstatCode(e.target.value)}
              placeholder="es. 015146"
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
            {submitting ? "Creazione in corso..." : "Crea Comune"}
          </button>
          {(name || province || istatCode) && (
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
  const formRef = useRef<HTMLFormElement>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);

  const [editingMun, setEditingMun] = useState<Municipality | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const [munName, setMunName] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");
  const [ref1Name, setRef1Name] = useState("");
  const [ref1Role, setRef1Role] = useState("");
  const [ref1Phone, setRef1Phone] = useState("");
  const [ref1Email, setRef1Email] = useState("");
  const [ref2Name, setRef2Name] = useState("");
  const [ref2Role, setRef2Role] = useState("");
  const [ref2Phone, setRef2Phone] = useState("");
  const [ref2Email, setRef2Email] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState<Feedback>(null);

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

  const handleEdit = (m: Municipality) => {
    setEditingMun(m);
    setMunName(m.name || "");
    setProvince(m.province || "");
    setNotes(m.notes || "");
    setRef1Name(m.ref1_name || "");
    setRef1Role(m.ref1_role || "");
    setRef1Phone(m.ref1_phone || "");
    setRef1Email(m.ref1_email || "");
    setRef2Name(m.ref2_name || "");
    setRef2Role(m.ref2_role || "");
    setRef2Phone(m.ref2_phone || "");
    setRef2Email(m.ref2_email || "");
    setEditFeedback(null);
    setShowEditForm(true);
    window.scrollTo(0, 0);
  };

  const resetEditForm = () => {
    setMunName(""); setProvince(""); setNotes("");
    setRef1Name(""); setRef1Role(""); setRef1Phone(""); setRef1Email("");
    setRef2Name(""); setRef2Role(""); setRef2Phone(""); setRef2Email("");
    setEditFeedback(null);
    setShowEditForm(false);
    setEditingMun(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referentId || !editingMun) return;

    setIsSubmitting(true);
    setEditFeedback(null);

    try {
      const fd = new FormData();
      fd.append("municipalityId", editingMun.id);
      fd.append("callerUserId", referentId);
      fd.append("municipalityName", munName);
      fd.append("province", province);
      fd.append("notes", notes);
      fd.append("ref1Name", ref1Name);
      fd.append("ref1Role", ref1Role);
      fd.append("ref1Phone", ref1Phone);
      fd.append("ref1Email", ref1Email);
      fd.append("ref2Name", ref2Name);
      fd.append("ref2Role", ref2Role);
      fd.append("ref2Phone", ref2Phone);
      fd.append("ref2Email", ref2Email);

      const result = await updateMunicipality(fd);

      if (result?.error) {
        setEditFeedback({ type: "error", text: result.error });
      } else {
        setEditFeedback({ type: "success", text: `Comune "${munName}" aggiornato con successo!` });
        const res = await getDashboardData(referentId);
        if (res.municipalities) setMunicipalities(res.municipalities as Municipality[]);
        router.refresh();
      }
    } catch (err) {
      console.error("Errore imprevisto nel frontend:", err);
      setEditFeedback({ type: "error", text: "Errore imprevisto di rete." });
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Modifica Comune */}
      {showEditForm && editingMun && (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">Modifica: {editingMun.name}</h2>
            <button onClick={resetEditForm} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Chiudi
            </button>
          </div>

          {editFeedback && (
            <div
              role="alert"
              className={`flex items-start gap-2 rounded-xl px-4 py-3 mb-5 text-sm font-semibold ${
                editFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <span>{editFeedback.type === "success" ? "v" : "x"}</span>
              <span>{editFeedback.text}</span>
            </div>
          )}

          <form ref={formRef} onSubmit={handleUpdate} noValidate className="space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">Dati Comune</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Comune *</label>
                  <input required value={munName} onChange={(e) => setMunName(e.target.value)} type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
                  <input value={province} onChange={(e) => setProvince(e.target.value)} type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">Referente Ufficiale 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Nome Cognome</label>
                  <input value={ref1Name} onChange={(e) => setRef1Name(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Ruolo</label>
                  <input value={ref1Role} onChange={(e) => setRef1Role(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefono</label>
                  <input value={ref1Phone} onChange={(e) => setRef1Phone(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input value={ref1Email} onChange={(e) => setRef1Email(e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">Referente Ufficiale 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Nome Cognome</label>
                  <input value={ref2Name} onChange={(e) => setRef2Name(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Ruolo</label>
                  <input value={ref2Role} onChange={(e) => setRef2Role(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefono</label>
                  <input value={ref2Phone} onChange={(e) => setRef2Phone(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input value={ref2Email} onChange={(e) => setRef2Email(e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" /></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button disabled={isSubmitting} type="submit"
                className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all text-sm disabled:opacity-50">
                {isSubmitting ? "Salvataggio..." : "Salva Modifiche"}
              </button>
              <button type="button" onClick={resetEditForm} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Comuni */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Comuni Registrati</h2>
        {municipalities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {municipalities.map((m) => (
              <div key={m.id} className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-lg">
                    {m.name} {m.province && <span className="text-sm font-normal text-slate-500">({m.province})</span>}
                  </p>
                  <p className="text-sm font-medium text-slate-500 mb-2">Admin Ente: {m.contact_name || "—"}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Ref 1: {m.ref1_name || "N.D."}</p>
                      {m.ref1_role && <p className="text-xs text-slate-500">{m.ref1_role}</p>}
                      {(m.ref1_phone || m.ref1_email) && (
                        <p className="text-xs text-slate-500 mt-1">{m.ref1_phone} {m.ref1_phone && m.ref1_email && "•"} {m.ref1_email}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Ref 2: {m.ref2_name || "N.D."}</p>
                      {m.ref2_role && <p className="text-xs text-slate-500">{m.ref2_role}</p>}
                      {(m.ref2_phone || m.ref2_email) && (
                        <p className="text-xs text-slate-500 mt-1">{m.ref2_phone} {m.ref2_phone && m.ref2_email && "•"} {m.ref2_email}</p>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleEdit(m)} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
                  Modifica
                </button>
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
