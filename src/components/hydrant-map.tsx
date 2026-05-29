"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import {
  Crosshair,
  Database,
  ImageUp,
  LocateFixed,
  MapPinPlus,
  Save,
  Search,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Hydrant, HydrantFormState, HydrantStatus, HydrantType } from "@/types/hydrant";

const DEFAULT_CENTER: LatLngExpression = [41.9028, 12.4964];
const STATUS_LABELS: Record<HydrantStatus, string> = {
  operativo: "Operativo",
  da_verificare: "Da verificare",
  fuori_servizio: "Fuori servizio",
};
const TYPE_LABELS: Record<HydrantType, string> = {
  soprassuolo: "Soprassuolo",
  sottosuolo: "Sottosuolo",
  colonnina: "Colonnina",
  naspo: "Naspo",
  altro: "Altro",
};

const emptyForm: HydrantFormState = {
  code: "",
  type: "soprassuolo",
  status: "da_verificare",
  notes: "",
  photo: null,
};

const hydrantIcon = L.divIcon({
  className: "",
  html: '<div class="hydrant-pin"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const draftIcon = L.divIcon({
  className: "",
  html: '<div class="hydrant-pin hydrant-pin--draft"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const userIcon = L.divIcon({
  className: "",
  html: '<div class="user-pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function LocationFlyTo({ position }: { position: LatLngExpression | null }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 0.8 });
    }
  }, [map, position]);

  return null;
}

function BoundsFlyTo({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
    }
  }, [map, bounds]);

  return null;
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (position: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });

  return null;
}

function buildPhotoPath(file: File, code: string) {
  const extension = file.name.split(".").pop() || "jpg";
  const safeCode = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "idrante";
  return `${safeCode}-${crypto.randomUUID()}.${extension}`;
}

export default function HydrantMap() {
  const [hydrants, setHydrants] = useState<Hydrant[]>([]);
  const [draftPosition, setDraftPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userPosition, setUserPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [form, setForm] = useState<HydrantFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("Tocca la mappa per censire un idrante.");
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [closestHydrantsIds, setClosestHydrantsIds] = useState<Set<string | number>>(new Set());

  const stats = useMemo(
    () => ({
      total: hydrants.length,
      operative: hydrants.filter((hydrant) => hydrant.status === "operativo").length,
      review: hydrants.filter((hydrant) => hydrant.status === "da_verificare").length,
    }),
    [hydrants],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setMessage("Geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMessage("Posizione rilevata. Premi Nuovo idrante qui per aprire la scheda.");
      },
      () => {
        setMessage("Posizione non autorizzata. La mappa resta navigabile manualmente.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    async function loadHydrants() {
      if (!supabase) {
        setLoadError("Configura Supabase per leggere e salvare gli idranti.");
        return;
      }

      const { data, error } = await supabase
        .from("hydrants")
        .select("id, code, type, status, notes, latitude, longitude, photo_url, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        return;
      }

      setHydrants((data ?? []) as Hydrant[]);
      setLoadError(null);
    }

    loadHydrants();
  }, []);

  function locateUser() {
    if (!navigator.geolocation) {
      setMessage("Geolocalizzazione non disponibile.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMessage("Mappa centrata sulla posizione corrente.");
      },
      () => setMessage("Impossibile leggere la posizione corrente."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function createHydrantAtCurrentPosition() {
    if (!userPosition) {
      setMessage("Posizione GPS non ancora disponibile.");
      return;
    }

    setDraftPosition(userPosition);
    setMessage("Scheda aperta sulla posizione GPS. Tocca la mappa solo per correggere.");
  }

  function correctDraftPosition(position: { latitude: number; longitude: number }) {
    if (!draftPosition) {
      setMessage("Premi Nuovo idrante qui prima di correggere manualmente la posizione.");
      return;
    }

    setDraftPosition(position);
    setMessage("Posizione corretta manualmente sulla mappa.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftPosition) {
      setMessage("Seleziona prima un punto sulla mappa.");
      return;
    }

    if (!form.code.trim()) {
      setMessage("Inserisci il codice identificativo dell'idrante.");
      return;
    }

    if (!supabase) {
      setMessage("Supabase non configurato: aggiungi le variabili ambiente.");
      return;
    }

    setIsSaving(true);
    setMessage("Salvataggio scheda tecnica...");

    try {
      let photoUrl: string | null = null;

      if (form.photo) {
        const path = buildPhotoPath(form.photo, form.code);
        const { error: uploadError } = await supabase.storage
          .from("hydrant-photos")
          .upload(path, form.photo, { upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("hydrant-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      const payload = {
        code: form.code.trim(),
        type: form.type,
        status: form.status,
        notes: form.notes.trim() || null,
        latitude: draftPosition.latitude,
        longitude: draftPosition.longitude,
        photo_url: photoUrl,
      };

      const { data, error } = await supabase
        .from("hydrants")
        .insert(payload)
        .select("id, code, type, status, notes, latitude, longitude, photo_url, created_at")
        .single();

      if (error) {
        throw error;
      }

      setHydrants((current) => [data as Hydrant, ...current]);
      setDraftPosition(null);
      setForm(emptyForm);
      setMessage("Idrante salvato su Supabase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    } finally {
      setIsSaving(false);
    }
  }

  function findClosestHydrants() {
    if (!userPosition) {
      setMessage("Posizione non disponibile. Premi il tasto geolocalizzazione.");
      return;
    }

    if (hydrants.length === 0) {
      setMessage("Nessun idrante sulla mappa.");
      return;
    }

    const userLatLng = L.latLng(userPosition.latitude, userPosition.longitude);
    
    // Calcola le distanze (in metri)
    const withDistances = hydrants.map((h) => ({
      ...h,
      distance: userLatLng.distanceTo(L.latLng(h.latitude, h.longitude)),
    }));

    // Ordina per distanza
    withDistances.sort((a, b) => a.distance - b.distance);

    // Prendi i 5 più vicini
    const closest = withDistances.slice(0, 5);

    setClosestHydrantsIds(new Set(closest.map((h) => h.id)));

    // Imposta i bounds per includere utente e idranti trovati
    const boundsPoints: L.LatLngExpression[] = [
      [userPosition.latitude, userPosition.longitude],
      ...closest.map((h) => [h.latitude, h.longitude] as L.LatLngExpression),
    ];
    setMapBounds(boundsPoints);
    setMessage(`Trovati i ${closest.length} idranti più vicini (entro ${Math.round(closest[closest.length - 1].distance)}m).`);
  }

  const selectedCoordinates = draftPosition
    ? `${draftPosition.latitude.toFixed(5)}, ${draftPosition.longitude.toFixed(5)}`
    : "Nessun punto selezionato";

  return (
    <main className="relative h-screen overflow-hidden bg-stone-100 text-slate-950">
      <MapContainer
        center={userPosition ? [userPosition.latitude, userPosition.longitude] : DEFAULT_CENTER}
        zoom={userPosition ? 15 : 6}
        minZoom={4}
        zoomControl={false}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={correctDraftPosition} />
        <LocationFlyTo
          position={userPosition ? [userPosition.latitude, userPosition.longitude] : null}
        />
        <BoundsFlyTo bounds={mapBounds} />

        {userPosition && (
          <Marker position={[userPosition.latitude, userPosition.longitude]} icon={userIcon}>
            <Tooltip direction="top" offset={[0, -10]}>
              Posizione utente
            </Tooltip>
          </Marker>
        )}

        {draftPosition && (
          <Marker position={[draftPosition.latitude, draftPosition.longitude]} icon={draftIcon}>
            <Tooltip direction="top" offset={[0, -24]} permanent>
              Nuovo idrante
            </Tooltip>
          </Marker>
        )}

        {hydrants.map((hydrant) => (
          <Marker
            key={hydrant.id}
            position={[hydrant.latitude, hydrant.longitude]}
            icon={hydrantIcon}
          >
            <Popup minWidth={220}>
              <article className="space-y-2 text-sm text-slate-800">
                {hydrant.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hydrant.photo_url}
                    alt={`Foto idrante ${hydrant.code}`}
                    className="h-32 w-full rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Codice
                  </p>
                  <h3 className="text-base font-semibold text-slate-950">{hydrant.code}</h3>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Tipo
                    </dt>
                    <dd>{TYPE_LABELS[hydrant.type]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Stato
                    </dt>
                    <dd>{STATUS_LABELS[hydrant.status]}</dd>
                  </div>
                </dl>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Note
                  </p>
                  <p className="whitespace-pre-wrap">{hydrant.notes || "Nessuna nota inserita."}</p>
                </div>
              </article>
            </Popup>
            <Tooltip direction="top" offset={[0, -24]}>
              {hydrant.code} - {STATUS_LABELS[hydrant.status]}
            </Tooltip>
          </Marker>
        ))}

        {hydrants.map((hydrant) => {
          const isClosest = closestHydrantsIds.has(hydrant.id);
          return (
            <CircleMarker
              key={`${hydrant.id}-range`}
              center={[hydrant.latitude, hydrant.longitude]}
              radius={isClosest ? 20 : 10}
              pathOptions={{
                color: isClosest ? "#2563eb" : (hydrant.status === "fuori_servizio" ? "#991b1b" : "#166534"),
                fillOpacity: isClosest ? 0.25 : 0.08,
                weight: isClosest ? 2 : 1,
              }}
            />
          );
        })}
      </MapContainer>

      <section className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-3 shadow-lg shadow-slate-900/10 backdrop-blur md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-700 text-white">
              <Siren size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight md:text-xl">Mappa Idranti</h1>
              <p className="truncate text-xs text-slate-600 md:text-sm">{message}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={findClosestHydrants}
              disabled={!userPosition || hydrants.length === 0}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerca idranti vicini"
              title="Cerca idranti vicini"
            >
              <Search size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={createHydrantAtCurrentPosition}
              disabled={!userPosition}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <MapPinPlus size={18} aria-hidden="true" />
              <span className="whitespace-nowrap">Nuovo idrante qui</span>
            </button>
            <button
              type="button"
              onClick={locateUser}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
              aria-label="Centra sulla posizione utente"
              title="Centra sulla posizione utente"
            >
              <LocateFixed size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <aside className="absolute inset-x-0 bottom-0 z-[500] max-h-[72vh] overflow-y-auto border-t border-slate-200 bg-white shadow-2xl shadow-slate-950/20 md:inset-y-5 md:left-auto md:right-5 md:max-h-none md:w-[390px] md:rounded-lg md:border">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Catasto operativo
              </p>
              <h2 className="mt-1 text-lg font-semibold">Scheda tecnica</h2>
            </div>
            {draftPosition && (
              <button
                type="button"
                onClick={() => setDraftPosition(null)}
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                aria-label="Annulla selezione"
                title="Annulla selezione"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-4 py-3">
          <Stat icon={<Database size={16} />} label="Totale" value={stats.total} />
          <Stat icon={<ShieldCheck size={16} />} label="Operativi" value={stats.operative} />
          <Stat icon={<Crosshair size={16} />} label="Verifica" value={stats.review} />
        </div>

        {!isSupabaseConfigured && (
          <div className="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Supabase non configurato. Crea un file .env.local con URL e chiave anonima.
          </div>
        )}

        {loadError && isSupabaseConfigured && (
          <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {loadError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <MapPinPlus size={16} aria-hidden="true" />
              Coordinate selezionate
            </div>
            <p className="mt-1 font-mono text-sm text-slate-950">{selectedCoordinates}</p>
          </div>

          <Field label="Codice">
            <input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="IDR-2026-001"
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
            <Field label="Tipologia">
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as HydrantType })}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Stato">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as HydrantStatus })
                }
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Note">
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={4}
              placeholder="Accessibilita, pressione, manutenzioni, riferimenti..."
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
            />
          </Field>

          <Field label="Foto">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600 transition hover:bg-slate-100">
              <ImageUp size={22} aria-hidden="true" />
              <span className="mt-2 line-clamp-2">
                {form.photo ? form.photo.name : "Carica una foto nel bucket hydrant-photos"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) =>
                  setForm({ ...form, photo: event.target.files?.[0] ?? null })
                }
              />
            </label>
          </Field>

          <button
            type="submit"
            disabled={isSaving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Save size={18} aria-hidden="true" />
            {isSaving ? "Salvataggio..." : "Salva idrante"}
          </button>
        </form>
      </aside>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
