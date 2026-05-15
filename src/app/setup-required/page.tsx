import { LogoutButton } from "@/components/logout-button";

export default function SetupRequiredPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Profilo mancante
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Account non associato</h1>
        <p className="mt-2 text-sm text-slate-600">
          L&apos;utente e autenticato in Supabase Auth, ma non ha ancora una riga in
          public.profiles con ruolo e comune. Crea il profilo dal database, poi rientra.
        </p>
        <div className="mt-5 flex justify-end">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
