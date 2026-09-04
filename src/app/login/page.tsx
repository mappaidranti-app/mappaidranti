"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { InstallPwaButton } from "@/components/install-pwa-button";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"operatore" | "admin">("operatore");
  
  // Operatore state
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  
  // Admin state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (activeTab === "operatore") {
      try {
        const { loginOperator } = await import("@/app/admin/actions");
        const res = await loginOperator(phone, pin);
        
        if (res.error) {
          setErrorMsg(res.error);
          setLoading(false);
          return;
        }

        if (res.success && res.operator) {
          // Salva in localStorage per la sessione della mappa
          localStorage.setItem("operatorData", JSON.stringify(res.operator));
          router.replace("/");
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Errore di connessione");
      }
      setLoading(false);
      return;
    }

    if (!supabase) return;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const DEV_EMAIL = "mappaidranti@gmail.com";
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("terms_accepted, role")
          .eq("id", data.user.id)
          .single();

        if (profileError) {
          console.error("Errore recupero profilo:", profileError);
          // Fallback per email sviluppatore
          if (data.user.email === DEV_EMAIL) {
            router.replace("/admin/superadmin");
            return;
          }
          router.replace("/");
          return;
        }
          
        if (profile?.role === "operator" && !profile?.terms_accepted) {
          router.replace("/accettazione-termini");
        } else if (profile?.role === "operator") {
          router.replace("/");
        } else if (profile?.role === "superadmin") {
          router.replace("/admin/superadmin");
        } else {
          router.replace("/admin");
        }
      } catch (err) {
        console.error("Errore recupero profilo (eccezione):", err);
        if (data.user.email === DEV_EMAIL) {
          router.replace("/admin/superadmin");
          return;
        }
        router.replace("/");
      }
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md mb-4 shadow-inner">
            <span className="text-3xl">🔥</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">IDRANTYA</h1>
          <p className="text-red-100 font-medium mt-1">Piattaforma Operativa</p>
        </div>

        <div className="p-8">
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => { setActiveTab("operatore"); setErrorMsg(""); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === "operatore" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Operatore
            </button>
            <button
              onClick={() => { setActiveTab("admin"); setErrorMsg(""); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === "admin" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Amministratore
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-sm font-medium flex items-start gap-3">
              <span className="text-rose-500 mt-0.5">⚠️</span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {activeTab === "operatore" ? (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="phone">
                    Numero di Telefono
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal"
                    placeholder="333 1234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="pin">
                    PIN (4 Cifre)
                  </label>
                  <input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal tracking-widest text-center text-xl"
                    placeholder="••••"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="email">
                    Email Istituzionale
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900 placeholder:font-normal"
                    placeholder="admin@comune.it"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900 placeholder:font-normal"
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-bold py-4 px-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 ${
                activeTab === "operatore"
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 shadow-red-600/25"
                  : "bg-slate-800 text-white hover:bg-slate-700 shadow-slate-900/20"
              } disabled:opacity-70 disabled:scale-100 active:scale-[0.98]`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <span>{activeTab === "operatore" ? "ACCEDI ALLA MAPPA" : "ACCEDI AL PANNELLO"}</span>
              )}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <InstallPwaButton />
            <p className="text-center text-xs font-semibold text-slate-400">
              IDRANTYA &copy; {new Date().getFullYear()} — VVF & Operatori
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
