"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, getAccessToken } from "@/lib/supabase";
import {
  createMunicipalityAndAdmin,
  getDashboardData,
  updateMunicipalityAndAdmin,
  deleteMunicipalityAndAdmin,
} from "@/app/admin/actions";
import OperatorsManager from "@/components/operators-manager";

type Municipality = {
  id: string;
  name: string;
  contact_name: string;
  admin_email?: string;
  admin_id?: string;
  province?: string;
  notes?: string;
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
      fd.append("accessToken", (await getAccessToken()) ?? "");

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

  const [editingMun, setEditingMun] = useState<Municipality | null>(null);
  const [editName, setEditName] = useState("");
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFeedback, setEditFeedback] = useState<Feedback>(null);

  const [deletingMun, setDeletingMun] = useState<Municipality | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    async function loadData() {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const result = await getDashboardData(session.access_token);
      if (result.isSuperAdmin) {
        setMunicipalities((result.municipalities as Municipality[]) || []);
        setReferentId(session.user.id);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleEditClick = (m: Municipality) => {
    setEditingMun(m);
    setEditName(m.name);
    setEditAdminName(m.contact_name);
    setEditAdminEmail(m.admin_email || "");
    setEditAdminPassword("");
    setEditFeedback(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMun) return;

    setIsUpdating(true);
    setEditFeedback(null);

    const fd = new FormData();
    fd.append("municipalityId", editingMun.id);
    fd.append("accessToken", (await getAccessToken()) ?? "");
    fd.append("municipalityName", editName.trim());
    fd.append("adminFullName", editAdminName.trim());
    fd.append("adminEmail", editAdminEmail.trim());
    if (editAdminPassword) {
      fd.append("adminPassword", editAdminPassword);
    }

    const res = await updateMunicipalityAndAdmin(fd);
    setIsUpdating(false);

    if (!res.success) {
      setEditFeedback({ type: "error", text: res.error || "Errore durante l'aggiornamento" });
      return;
    }

    setEditFeedback({ type: "success", text: "Modifiche salvate con successo!" });
    
    // Ricarica la lista localmente
    setMunicipalities((prev) =>
      prev.map((m) =>
        m.id === editingMun.id
          ? { ...m, name: editName, contact_name: editAdminName, admin_email: editAdminEmail }
          : m
      )
    );
    
    setTimeout(() => {
      setEditingMun(null);
    }, 1500);
  };

  const handleDelete = async () => {
    if (!deletingMun) return;
    setIsDeleting(true);

    const fd = new FormData();
    fd.append("municipalityId", deletingMun.id);
    fd.append("accessToken", (await getAccessToken()) ?? "");
    
    const res = await deleteMunicipalityAndAdmin(fd);
    setIsDeleting(false);

    if (res.success) {
      setMunicipalities((prev) => prev.filter((m) => m.id !== deletingMun.id));
      setDeletingMun(null);
    } else {
      alert("Errore eliminazione: " + res.error);
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
                  <p className="text-sm text-slate-500 mt-0.5">Admin Ente: {m.contact_name || "—"} {m.admin_email ? `(${m.admin_email})` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEditClick(m)} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
                    Modifica
                  </button>
                  <button onClick={() => setDeletingMun(m)} className="text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-4 py-2 rounded-lg transition-colors">
                    Elimina
                  </button>
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

      {/* Modal Modifica */}
      {editingMun && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Modifica Comune</h3>
              <button onClick={() => setEditingMun(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {editFeedback && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${editFeedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {editFeedback.text}
                </div>
              )}
              
              <form id="editForm" onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Comune <span className="text-rose-500">*</span></label>
                  <input required type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Admin <span className="text-rose-500">*</span></label>
                  <input required type="text" value={editAdminName} onChange={(e) => setEditAdminName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Admin <span className="text-rose-500">*</span></label>
                  <input required type="email" value={editAdminEmail} onChange={(e) => setEditAdminEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nuova Password (lascia vuoto per non cambiare)</label>
                  <input type="password" value={editAdminPassword} onChange={(e) => setEditAdminPassword(e.target.value)} placeholder="Minimo 6 caratteri" autoComplete="new-password" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingMun(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                Annulla
              </button>
              <button type="submit" form="editForm" disabled={isUpdating} className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50">
                {isUpdating ? "Salvataggio..." : "Salva Modifiche"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminazione */}
      {deletingMun && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600 text-xl font-bold">!</div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">Elimina Comune</h3>
              <p className="text-sm text-slate-500">
                Sei sicuro di voler eliminare il comune <strong>{deletingMun.name}</strong> e il suo account Admin associato? Questa operazione è irreversibile.
              </p>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button type="button" onClick={() => setDeletingMun(null)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                Annulla
              </button>
              <button type="button" onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50">
                {isDeleting ? "Eliminazione..." : "Elimina Definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
