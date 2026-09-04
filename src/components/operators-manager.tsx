"use client";

import { useState, useEffect } from "react";
import { getOperatorsByMunicipality, createOperator, toggleOperatorStatus, deleteOperator } from "@/app/admin/actions";
import type { Operator } from "@/types";
import { Trash2, UserPlus, Power, PowerOff } from "lucide-react";

type Municipality = {
  id: string;
  name: string;
};

export default function OperatorsManager({
  municipalities,
  referentId
}: {
  municipalities: Municipality[];
  referentId: string;
}) {
  const [selectedMunId, setSelectedMunId] = useState<string>(municipalities.length === 1 ? municipalities[0].id : "");
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  useEffect(() => {
    if (selectedMunId) {
      loadOperators(selectedMunId);
    } else {
      setOperators([]);
    }
  }, [selectedMunId]);

  const loadOperators = async (munId: string) => {
    setLoading(true);
    const res = await getOperatorsByMunicipality(munId);
    if (res.operators) {
      setOperators(res.operators as Operator[]);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMunId || !referentId) {
      setMessage({ type: "error", text: "Seleziona un comune." });
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      setMessage({ type: "error", text: "Il PIN deve essere di 4-6 cifre." });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    const formData = new FormData();
    formData.append("municipality_id", selectedMunId);
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("pin", pin);
    formData.append("referentId", referentId);
    
    const res = await createOperator(formData);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "Operatore creato con successo!" });
      setName("");
      setPhone("");
      setPin("");
      loadOperators(selectedMunId);
    }
    setIsSubmitting(false);
  };

  const handleToggle = async (operatorId: string, currentStatus: boolean) => {
    const res = await toggleOperatorStatus(operatorId, !currentStatus);
    if (res.error) {
      alert("Errore: " + res.error);
    } else {
      setOperators(ops => ops.map(o => o.id === operatorId ? { ...o, is_active: !currentStatus } : o));
    }
  };

  const handleDelete = async (operatorId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo operatore?")) return;
    
    const res = await deleteOperator(operatorId, referentId);
    if (res.error) {
      alert("Errore: " + res.error);
    } else {
      setOperators(ops => ops.filter(o => o.id !== operatorId));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <UserPlus className="text-slate-500" size={24} />
        Gestione Operatori Campo
      </h2>

      {municipalities.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">Seleziona Comune di Riferimento</label>
          <select 
            value={selectedMunId} 
            onChange={(e) => setSelectedMunId(e.target.value)}
            className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
          >
            <option value="" disabled>-- Scegli un comune --</option>
            {municipalities.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedMunId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Creazione */}
          <div className="lg:col-span-1 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <h3 className="text-md font-bold text-slate-800 mb-4">Nuovo Operatore</h3>
            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm font-semibold ${message.type === "error" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                {message.text}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome o ID Squadra *</label>
                <input required value={name} onChange={e => setName(e.target.value)} type="text"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Es. Mario Rossi / Squadra A" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefono *</label>
                <input required value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Es. +39 333 1234567" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PIN di Accesso (4-6 cifre) *</label>
                <input required value={pin} onChange={e => setPin(e.target.value)} type="password" minLength={4} maxLength={6} pattern="[0-9]{4,6}"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none tracking-widest" placeholder="••••" />
              </div>
              <button disabled={isSubmitting} type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-all text-sm disabled:opacity-50 mt-2">
                {isSubmitting ? "Salvataggio..." : "Crea Operatore"}
              </button>
            </form>
          </div>

          {/* Lista Operatori */}
          <div className="lg:col-span-2">
            <h3 className="text-md font-bold text-slate-800 mb-4">Operatori Registrati</h3>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Caricamento operatori...</div>
            ) : operators.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm font-medium text-slate-500">
                Nessun operatore configurato per questo comune.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Nome / Squadra</th>
                      <th className="px-4 py-3">Telefono</th>
                      <th className="px-4 py-3">Stato</th>
                      <th className="px-4 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {operators.map(op => (
                      <tr key={op.id} className={`hover:bg-slate-50 transition-colors ${!op.is_active ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {op.name}
                          <div className="text-xs font-normal text-slate-500 mt-0.5">Creazione: {new Date(op.created_at).toLocaleDateString("it-IT")}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">{op.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${op.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                            {op.is_active ? "Attivo" : "Inattivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button 
                            onClick={() => handleToggle(op.id, op.is_active)}
                            className={`p-1.5 rounded-lg transition-colors ${op.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                            title={op.is_active ? "Disabilita accesso" : "Abilita accesso"}
                          >
                            {op.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                          </button>
                          <button 
                            onClick={() => handleDelete(op.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Elimina operatore"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Seleziona un comune per visualizzare gli operatori.</p>
        </div>
      )}
    </div>
  );
}
