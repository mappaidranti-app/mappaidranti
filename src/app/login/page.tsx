"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { forceAdminSetup } from "../admin/actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [forceAdmin, setForceAdmin] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      if (forceAdmin) {
        setLoading(true);
        // Forza setup come admin tramite Server Action (bypass RLS)
        const result = await forceAdminSetup(data.user.id, data.user.email || "");
        if (result.error) {
          setErrorMsg(result.error);
          setLoading(false);
          return;
        }
        router.push("/admin");
        return;
      }

      // Check role to redirect appropriately
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // 🔍 DEBUG: mostra esattamente cosa torna dal DB
      const debugMsg = `USER ID: ${data.user.id}\nPROFILE: ${JSON.stringify(profile)}\nERROR: ${JSON.stringify(profileError)}`;
      console.log("🔍 [LOGIN DEBUG]", debugMsg);
      // alert("DEBUG LOGIN:\n" + debugMsg);

      if (profile?.role === "referent") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Operatori</h1>
          <p className="text-gray-500">Accedi per gestire la mappatura idranti</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center mt-4">
            <input
              id="forceAdmin"
              type="checkbox"
              checked={forceAdmin}
              onChange={(e) => setForceAdmin(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="forceAdmin" className="ml-2 block text-sm text-gray-900 font-medium">
              Forza l'accesso come Amministratore (Bypass)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              "Accedi"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
