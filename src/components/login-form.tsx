"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, LogIn } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage("Configura le variabili Supabase prima di accedere.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/10"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-red-700 text-white">
          <Flame size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mappa Idranti</h1>
          <p className="text-sm text-slate-600">Accesso piattaforma multi-comune</p>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Supabase non configurato. Aggiungi URL e anon key nelle variabili ambiente.
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
        />
      </label>

      {message && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <LogIn size={18} aria-hidden="true" />
        {isLoading ? "Accesso..." : "Accedi"}
      </button>
    </form>
  );
}
