"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AccettazioneTerminiPage() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    if (!accepted || !supabase) return;
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ terms_accepted: true })
        .eq("id", session.user.id);

      if (!error) {
        router.push("/");
      } else {
        setLoading(false);
        alert("Si è verificato un errore durante l'accettazione dei termini.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md mb-4 shadow-inner">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">ATTENZIONE</h1>
          <p className="text-red-100 font-medium mt-1">Primo accesso operatore</p>
        </div>

        <div className="p-8">
          <div className="mb-6 space-y-4 text-slate-600">
            <h2 className="text-xl font-bold text-slate-800">Documento di Responsabilità e Incarico</h2>
            <p>
              L'accesso a questa piattaforma è strettamente riservato al personale autorizzato per il censimento e la manutenzione degli idranti della rete idrica comunale.
            </p>
            <p>
              In qualità di operatore, ti impegni a:
            </p>
            <ul className="list-disc pl-5 space-y-2 font-medium text-slate-700">
              <li>Inserire dati veritieri e accurati durante i sopralluoghi.</li>
              <li>Scattare fotografie nitide e chiare dello stato dell'infrastruttura.</li>
              <li>Segnalare tempestivamente qualsiasi anomalia o rischio per la sicurezza pubblica.</li>
              <li>Mantenere la riservatezza delle credenziali di accesso.</li>
            </ul>
            <p>
              Tutte le operazioni effettuate sulla piattaforma sono tracciate e associate al tuo profilo utente.
            </p>
          </div>

          <div className="mb-8">
            <a 
              href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-slate-800 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:bg-slate-700 transition-all active:scale-[0.98]"
            >
              <span className="text-2xl">🎥</span>
              GUARDA VIDEO TUTORIAL
            </a>
          </div>

          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-1">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="peer appearance-none w-6 h-6 border-2 border-slate-300 rounded-md checked:bg-red-600 checked:border-red-600 focus:ring-2 focus:ring-red-500/20 transition-all cursor-pointer"
                />
                <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span className="text-base font-bold text-slate-800 select-none group-hover:text-red-700 transition-colors">
                Ho letto, compreso e accetto i doveri dell'operatore descritti nel presente incarico.
              </span>
            </label>
            
            <button
              onClick={handleAccept}
              disabled={!accepted || loading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-red-600/25 hover:from-red-500 hover:to-rose-500 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-[0.98]"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
              ) : (
                "CONFERMA E ACCEDI ALLA MAPPA"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
