"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createMunicipality, getDashboardData } from "@/app/admin/actions";

type Municipality = {
  id: string;
  name: string;
  contact_name: string;
};

export default function SuperAdminPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);

  const [munName, setMunName] = useState("");
  const [munRefName, setMunRefName] = useState("");
  const [munRefEmail, setMunRefEmail] = useState("");
  const [munRefPassword, setMunRefPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referentId) return;
    setIsSubmitting(true);
    setMessage(null);
    
    const formData = new FormData();
    formData.append("municipalityName", munName);
    formData.append("referentName", munRefName);
    formData.append("referentEmail", munRefEmail);
    formData.append("referentPassword", munRefPassword);
    formData.append("callerUserId", referentId);
    
    const result = await createMunicipality(formData);
    
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: `Comune "${munName}" creato con successo!` });
      setMunName(""); setMunRefName(""); setMunRefEmail(""); setMunRefPassword("");
      setShowForm(false);
      
      const res = await getDashboardData(referentId);
      if (res.municipalities) setMunicipalities(res.municipalities as Municipality[]);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Caricamento...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pannello Super Admin</h1>
            <p className="text-slate-500 text-sm mt-1">{municipalities.length} comuni registrati</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setMessage(null); }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold text-sm transition-all"
          >
            {showForm ? "Annulla" : "+ Aggiungi Comune"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-5">Nuovo Comune + Admin Ente</h2>
          {message && (
            <div className={`p-3 rounded-lg mb-4 text-sm font-semibold ${message.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              {message.text}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Comune</label>
              <input required value={munName} onChange={e => setMunName(e.target.value)} type="text"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="es. Milano" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Admin Ente</label>
              <input required value={munRefName} onChange={e => setMunRefName(e.target.value)} type="text"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="Mario Rossi" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Istituzionale</label>
              <input required value={munRefEmail} onChange={e => setMunRefEmail(e.target.value)} type="email"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="admin@comune.it" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Password Iniziale</label>
              <input required minLength={6} value={munRefPassword} onChange={e => setMunRefPassword(e.target.value)} type="text"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="password sicura" />
            </div>
            <div className="md:col-span-2">
              <button disabled={isSubmitting} type="submit"
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-all text-sm disabled:opacity-50 mt-2">
                {isSubmitting ? "Creazione in corso..." : "Crea Comune e Admin Ente"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Comuni Registrati</h2>
        {municipalities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {municipalities.map((m) => (
              <div key={m.id} className="py-4">
                <p className="font-bold text-slate-900 text-lg">{m.name}</p>
                <p className="text-sm font-medium text-slate-500">Admin: {m.contact_name || "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm font-medium">Nessun comune registrato.</p>
          </div>
        )}
      </div>
    </div>
  );
}
