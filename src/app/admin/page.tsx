"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { createOperator } from "./actions";

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

export default function AdminPage() {
  const [data, setData] = useState<Municipality | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [referentId, setReferentId] = useState<string | null>(null);
  const router = useRouter();

  // Stati per il form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        setDebugInfo("❌ Supabase non configurato");
        router.push("/login");
        return;
      }
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("🔍 [ADMIN DEBUG] session:", session, "sessionError:", sessionError);
        
        if (!session) {
          setDebugInfo("❌ Nessuna sessione attiva");
          console.log("🔍 [ADMIN DEBUG] Nessuna sessione → redirect a /login");
          router.push("/login");
          return;
        }
        
        setReferentId(session.user.id);
        console.log("🔍 [ADMIN DEBUG] User ID:", session.user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, municipality_id")
          .eq("id", session.user.id)
          .single();

        console.log("🔍 [ADMIN DEBUG] profile:", JSON.stringify(profile), "profileError:", JSON.stringify(profileError));

        if (profileError || profile?.role !== "referent") {
          const reason = profileError
            ? `Errore profilo: ${profileError.message} (code: ${profileError.code})`
            : `Ruolo non valido: "${profile?.role}" (atteso: "referent")`;
          console.error("🔍 [ADMIN DEBUG] REDIRECT MOTIVO:", reason);
          setDebugInfo(`❌ ${reason}`);
          // NON redirigere automaticamente per debug: mostra l'errore
          setLoading(false);
          return;
        }

        const municipalityId = profile?.municipality_id;
        
        let query = supabase.from("municipalities").select("*");
        if (municipalityId) {
          query = query.eq("id", municipalityId).limit(1);
        } else {
          query = query.limit(1);
        }

        const { data: municipalities, error } = await query;

        if (!error && municipalities && municipalities.length > 0) {
          setData(municipalities[0]);
          
          // Se abbiamo trovato il comune, carichiamo gli operatori
          const { data: ops } = await supabase
            .from("profiles")
            .select("id, full_name, email, created_at")
            .eq("role", "operator")
            .eq("municipality_id", municipalities[0].id)
            .order("created_at", { ascending: false });
            
          if (ops) setOperators(ops);
        }
      } catch (err) {
        console.error("Errore nel recupero dati:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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
      
      // Aggiorna lista locale
      const newOp: Operator = {
        id: Math.random().toString(), // temp ID
        full_name: formName,
        email: formEmail,
        created_at: new Date().toISOString()
      };
      setOperators([newOp, ...operators]);
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pt-12 md:pt-20">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 🔍 Banner di debug - DA RIMUOVERE dopo aver risolto */}
        {debugInfo && (
          <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-900 p-4 rounded-xl text-sm font-mono">
            <p className="font-bold mb-1">🔍 DEBUG INFO (temporaneo):</p>
            <p>{debugInfo}</p>
            <p className="mt-2 text-xs text-yellow-700">
              Apri la console del browser (F12) per i dettagli completi.
            </p>
          </div>
        )}
        
        {/* Card Info Comune */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Pannello Referente</h1>
            <button 
              onClick={() => { supabase?.auth.signOut(); router.push('/login'); }}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Esci
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500 font-medium mb-1">Comune</p>
                <p className="text-xl font-bold text-gray-900">{data.name}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500 font-medium mb-1">Operatori in piattaforma</p>
                <p className="text-xl font-bold text-gray-900">{operators.length}</p>
              </div>
            </div>
          ) : (
             <div className="text-center py-6 bg-gray-50 rounded-xl">
               <p className="text-gray-500">Nessun comune associato a questo profilo.</p>
             </div>
          )}
        </div>

        {/* Gestione Operatori */}
        {!loading && data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Aggiunta */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Nuovo Operatore</h2>
              
              {formMessage && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${formMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {formMessage.text}
                </div>
              )}

              <form onSubmit={handleAddOperator} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome e Cognome</label>
                  <input required value={formName} onChange={e => setFormName(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Mario Rossi" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input required value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="mario@email.it" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password Iniziale</label>
                  <input required minLength={6} value={formPassword} onChange={e => setFormPassword(e.target.value)} type="text" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="password_sicura" />
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-all text-sm disabled:opacity-50">
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
                    <div key={op.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">{op.full_name}</p>
                        <p className="text-sm text-gray-500">{op.email}</p>
                      </div>
                      <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">
                        Attivo
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
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
