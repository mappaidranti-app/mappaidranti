import fs from 'fs';
import path from 'path';

const fileContent = `"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createMunicipality, getDashboardData, updateMunicipality } from "@/app/admin/actions";

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

export default function SuperAdminPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);

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

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingMun, setEditingMun] = useState<Municipality | null>(null);

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
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referentId) return;
    setIsSubmitting(true);
    setMessage(null);
    
    const formData = new FormData();
    formData.append("municipalityName", munName);
    formData.append("province", province);
    formData.append("notes", notes);
    formData.append("ref1Name", ref1Name);
    formData.append("ref1Role", ref1Role);
    formData.append("ref1Phone", ref1Phone);
    formData.append("ref1Email", ref1Email);
    formData.append("ref2Name", ref2Name);
    formData.append("ref2Role", ref2Role);
    formData.append("ref2Phone", ref2Phone);
    formData.append("ref2Email", ref2Email);
    formData.append("callerUserId", referentId);
    
    if (editingMun) {
        formData.append("municipalityId", editingMun.id);
        const result = await updateMunicipality(formData);
        
        if (result.error) {
          setMessage({ type: "error", text: result.error });
        } else {
          setMessage({ type: "success", text: \`Comune "\${munName}" aggiornato con successo!\` });
          resetForm();
          const res = await getDashboardData(referentId);
          if (res.municipalities) setMunicipalities(res.municipalities as Municipality[]);
        }
    } else {
        formData.append("adminName", adminName);
        formData.append("adminEmail", adminEmail);
        formData.append("adminPassword", adminPassword);
        
        const result = await createMunicipality(formData);
        
        if (result.error) {
          setMessage({ type: "error", text: result.error });
        } else {
          setMessage({ type: "success", text: \`Comune "\${munName}" creato con successo!\` });
          resetForm();
          const res = await getDashboardData(referentId);
          if (res.municipalities) setMunicipalities(res.municipalities as Municipality[]);
        }
    }
    
    setIsSubmitting(false);
  };

  const resetForm = () => {
      setMunName(""); setProvince(""); setNotes("");
      setRef1Name(""); setRef1Role(""); setRef1Phone(""); setRef1Email("");
      setRef2Name(""); setRef2Role(""); setRef2Phone(""); setRef2Email("");
      setAdminName(""); setAdminEmail(""); setAdminPassword("");
      setShowForm(false);
      setEditingMun(null);
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
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); setMessage(null); }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold text-sm transition-all"
          >
            {showForm ? "Annulla" : "+ Aggiungi Comune"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-5">{editingMun ? "Modifica Comune" : "Nuovo Comune + Admin Ente"}</h2>
          {message && (
            <div className={\`p-3 rounded-lg mb-4 text-sm font-semibold \${message.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}\`}>
              {message.text}
            </div>
          )}
          <form onSubmit={handleCreateOrUpdate} className="space-y-6">
            {/* Dati Comune */}
            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">1. Dati Comune</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Comune *</label>
                    <input required value={munName} onChange={e => setMunName(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="es. Milano" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
                    <input value={province} onChange={e => setProvince(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="es. MI" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="Note aggiuntive..." />
                  </div>
              </div>
            </div>

            {/* Referente 1 */}
            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">2. Referente Ufficiale 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Cognome</label>
                    <input value={ref1Name} onChange={e => setRef1Name(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ruolo</label>
                    <input value={ref1Role} onChange={e => setRef1Role(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Telefono</label>
                    <input value={ref1Phone} onChange={e => setRef1Phone(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input value={ref1Email} onChange={e => setRef1Email(e.target.value)} type="email"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
              </div>
            </div>

            {/* Referente 2 */}
            <div>
              <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">3. Referente Ufficiale 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Cognome</label>
                    <input value={ref2Name} onChange={e => setRef2Name(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ruolo</label>
                    <input value={ref2Role} onChange={e => setRef2Role(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Telefono</label>
                    <input value={ref2Phone} onChange={e => setRef2Phone(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input value={ref2Email} onChange={e => setRef2Email(e.target.value)} type="email"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
              </div>
            </div>

            {/* Credenziali Admin Ente */}
            {!editingMun && (
              <div>
                <h3 className="text-md font-bold text-slate-700 mb-3 border-b pb-2">4. Credenziali Admin Ente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Admin Ente *</label>
                    <input required value={adminName} onChange={e => setAdminName(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="Mario Rossi" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Istituzionale (Login) *</label>
                    <input required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="admin@comune.it" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password Iniziale *</label>
                    <input required minLength={6} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-500 outline-none" placeholder="password sicura" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <button disabled={isSubmitting} type="submit"
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all text-sm disabled:opacity-50 mt-4">
                {isSubmitting ? "Salvataggio in corso..." : (editingMun ? "Salva Modifiche" : "Crea Comune e Admin Ente")}
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
                            <p className="text-xs text-slate-500 mt-1">
                                {m.ref1_phone} {m.ref1_phone && m.ref1_email && "•"} {m.ref1_email}
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">Ref 2: {m.ref2_name || "N.D."}</p>
                        {m.ref2_role && <p className="text-xs text-slate-500">{m.ref2_role}</p>}
                        {(m.ref2_phone || m.ref2_email) && (
                            <p className="text-xs text-slate-500 mt-1">
                                {m.ref2_phone} {m.ref2_phone && m.ref2_email && "•"} {m.ref2_email}
                            </p>
                        )}
                    </div>
                  </div>
                </div>
                
                <button
                    onClick={() => handleEdit(m)}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                >
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
    </div>
  );
}
`;

fs.writeFileSync(path.join('d:', 'Progetti Git Hub', 'mappaidranti', 'src', 'app', 'admin', 'superadmin', 'page.tsx'), fileContent, 'utf-8');
console.log('Done.');
