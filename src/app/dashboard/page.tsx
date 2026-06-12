"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOperator, deleteOperator, getDashboardData } from "./actions";

type Municipality = {
  id: string;
  name: string;
  contact_name: string;
  operators_count: number;
  created_at: string;
};

type Operator = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<Municipality | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  // Stati per il form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const fetchDashboard = async () => {
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      const result = await getDashboardData(session.user.id);
      if (result.error) {
        setIsAuthorized(false);
      } else {
        setIsAuthorized(true);
        if (result.municipality) setData(result.municipality as Municipality);
        if (result.operators) setOperators(result.operators as Operator[]);
        if (result.referentId) setReferentId(result.referentId as string);
      }
    } catch (err) {
      console.error("Errore nel recupero dati:", err);
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [router]);

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referentId || !data?.id) return;
    
    setIsSubmitting(true);
    setFormMessage(null);

    const formData = new FormData();
    formData.append("email", formEmail);
    formData.append("password", formPassword);
    formData.append("fullName", formName);
    formData.append("referentId", referentId);
    formData.append("municipalityId", data.id);

    const result = await createOperator(formData);

    if (result.error) {
      setFormMessage({ type: 'error', text: result.error });
    } else {
      setFormMessage({ type: 'success', text: "Operatore aggiunto con successo!" });
      setFormName("");
      setFormEmail("");
      setFormPassword("");
      
      // Ricarica la lista chiamando la server action
      fetchDashboard();
    }
    
    setIsSubmitting(false);
  };

  const handleDeleteOperator = async (operatorId: string) => {
    if (!referentId) return;
    if (!confirm("Sei sicuro di voler eliminare questo operatore?")) return;
    
    const result = await deleteOperator(operatorId, referentId);
    if (result.error) {
      alert("Errore durante l'eliminazione: " + result.error);
    } else {
      setOperators(operators.filter(op => op.id !== operatorId));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] p-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-8 rounded-2xl max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Accesso Negato</h2>
          <p>Non hai i permessi di Referente per visualizzare questo pannello di controllo.</p>
          <button 
            onClick={() => router.push("/")}
            className="mt-6 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Torna alla Mappa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pt-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Card Info Comune */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Pannello Referente</h1>
          
          {data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl">
                <p className="text-sm text-blue-600 font-medium mb-1">Comune Gestito</p>
                <p className="text-2xl font-bold text-gray-900">{data.name}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl">
                <p className="text-sm text-gray-500 font-medium mb-1">Operatori in piattaforma</p>
                <p className="text-2xl font-bold text-gray-900">{operators.length}</p>
              </div>
            </div>
          ) : (
             <div className="text-center py-6 bg-gray-50 rounded-xl">
               <p className="text-gray-500">Nessun comune associato a questo profilo.</p>
             </div>
          )}
        </div>

        {/* Gestione Operatori */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Aggiunta */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Aggiungi Operatore</h2>
              
              {formMessage && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${formMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {formMessage.text}
                </div>
              )}

              <form onSubmit={handleAddOperator} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome e Cognome</label>
                  <input required value={formName} onChange={e => setFormName(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Mario Rossi" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input required value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="mario@email.it" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password Iniziale</label>
                  <input required minLength={6} value={formPassword} onChange={e => setFormPassword(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="password_sicura" />
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-all text-sm disabled:opacity-50 mt-2">
                  {isSubmitting ? "Creazione in corso..." : "Aggiungi Operatore"}
                </button>
              </form>
            </div>

            {/* Lista Operatori */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Operatori Autorizzati</h2>
              
              {operators.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {operators.map((op) => (
                    <div key={op.id} className="py-4 flex justify-between items-center group">
                      <div>
                        <p className="font-semibold text-gray-900">{op.full_name}</p>
                        <p className="text-sm text-gray-500">{op.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">
                          Attivo
                        </span>
                        <button 
                          onClick={() => handleDeleteOperator(op.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                          title="Elimina operatore"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 text-sm">Non ci sono operatori autorizzati.</p>
                </div>
              )}
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
