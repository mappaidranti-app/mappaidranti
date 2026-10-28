"use client";

import dynamic from "next/dynamic";

const HydrantMap = dynamic(() => import("@/components/hydrant-map"), {
  ssr: false,
  loading: () => (
    <div className="grid flex-1 place-items-center bg-slate-950 text-slate-100">
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-sm">
        Caricamento mappa operativa...
      </div>
    </div>
  ),
});

/** Mappa operativa del pannello: tutti gli idranti, ricerca e nuovo idrante. */
export default function MappaOperativaPage() {
  return <HydrantMap mode="operativa" />;
}
