 "use client";

import dynamic from "next/dynamic";

const HydrantMap = dynamic(() => import("@/components/hydrant-map"), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-sm">
        Caricamento mappa idranti...
      </div>
    </main>
  ),
});

export default function Home() {
  return <HydrantMap />;
}
