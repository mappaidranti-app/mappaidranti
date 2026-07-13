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
  Loader2,
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
  Funzionante: "Funzionante",
  "Non funzionante": "Non funzionante",
  "Da verificare": "Da verificare",
};
const TYPE_LABELS: Record<HydrantType, string> = {
  Soprasuolo: "Soprasuolo",
  Sottosuolo: "Sottosuolo",
  Parete: "Parete",
};

const emptyForm: HydrantFormState = {
  code: "",
  hamlet: "",
  street: "",
  street_number: "",
  type: "Soprasuolo",
  connections: [],
  status: "Funzionante",
  sign_present: null,
  accessibility: "",
  notes: "",
  photoCloseUp: null,
  photoPanoramic: null,
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
    accuracy?: number;
  } | null>(null);
  const [userPosition, setUserPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [form, setForm] = useState<HydrantFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("Tocca la mappa per censire un idrante.");
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [closestHydrantsIds, setClosestHydrantsIds] = useState<Set<string | number>>(new Set());
  const [municipalityId, setMunicipalityId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      total: hydrants.length,
      operative: hydrants.filter((hydrant) => hydrant.status === "Funzionante").length,
      review: hydrants.filter((hydrant) => hydrant.status === "Da verificare").length,
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
          accuracy: position.coords.accuracy,
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("municipality_id")
          .eq("id", sessionData.session.user.id)
          .single();
        if (profile?.municipality_id) {
          setMunicipalityId(profile.municipality_id);
        }
      }

      const { data, error } = await supabase
        .from("hydrants")
        .select("id, code, type, status, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, accessibility")
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
          accuracy: position.coords.accuracy,
        });
        setMessage("Mappa centrata sulla posizione corrente.");
      },
      () => setMessage("Impossibile leggere la posizione corrente."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function createHydrantAtCurrentPosition() {
    if (!userPosition) {
      setMessage("Posizione GPS non ancora disponibile.");
      return;
    }

    setDraftPosition(userPosition);
    setMessage("Scheda aperta sulla posizione GPS. Recupero indirizzo in corso...");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userPosition.latitude}&lon=${userPosition.longitude}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const address = data.address;
          const street = address.road || "";
          const street_number = address.house_number || "";
          const hamlet = address.city || address.town || address.village || address.hamlet || address.municipality || "";
          
          setForm(prev => ({
            ...prev,
            street,
            street_number,
            hamlet
          }));
          setMessage("Indirizzo recuperato con successo da GPS.");
          return;
        }
      }
      setMessage("Scheda aperta sulla posizione GPS. Dettagli indirizzo non disponibili.");
    } catch {
      setMessage("Scheda aperta sulla posizione GPS. Tocca la mappa solo per correggere.");
    }
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

    if (!form.street.trim()) {
      setMessage("Inserisci la via.");
      return;
    }

    if (!form.photoCloseUp || !form.photoPanoramic) {
      setMessage("Scatta sia la foto ravvicinata che la foto panoramica.");
      return;
    }

    if (!supabase) {
      setMessage("Supabase non configurato: aggiungi le variabili ambiente.");
      return;
    }

    setIsSaving(true);
    setMessage("Salvataggio scheda tecnica e foto...");

    try {
      let photoUrl: string | null = null;
      let notesWithPhoto = form.notes.trim();

      const pathPanoramic = buildPhotoPath(form.photoPanoramic, form.code + '-panoramica');
      const { error: uploadErrorPanoramic } = await supabase.storage
        .from("hydrant-photos")
        .upload(pathPanoramic, form.photoPanoramic, { upsert: false });

      if (uploadErrorPanoramic) throw uploadErrorPanoramic;

      const { data: dataPanoramic } = supabase.storage.from("hydrant-photos").getPublicUrl(pathPanoramic);
      photoUrl = dataPanoramic.publicUrl;

      const pathCloseUp = buildPhotoPath(form.photoCloseUp, form.code + '-ravvicinata');
      const { error: uploadErrorCloseUp } = await supabase.storage
        .from("hydrant-photos")
        .upload(pathCloseUp, form.photoCloseUp, { upsert: false });

      if (uploadErrorCloseUp) throw uploadErrorCloseUp;

      const { data: dataCloseUp } = supabase.storage.from("hydrant-photos").getPublicUrl(pathCloseUp);
      
      notesWithPhoto = notesWithPhoto 
        ? `${notesWithPhoto}\n\n[Foto Ravvicinata]: ${dataCloseUp.publicUrl}` 
        : `[Foto Ravvicinata]: ${dataCloseUp.publicUrl}`;

      const payload = {
        code: form.code.trim(),
        type: form.type,
        status: form.status,
        notes: notesWithPhoto || null,
        latitude: draftPosition.latitude,
        longitude: draftPosition.longitude,
        photo_url: photoUrl,
        municipality_id: municipalityId,
        hamlet: form.hamlet.trim() || null,
        street: form.street.trim() || null,
        street_number: form.street_number.trim() || null,
        connections: form.connections,
        sign_present: form.sign_present,
        accessibility: form.accessibility || null,
      };

      const { data, error } = await supabase
        .from("hydrants")
        .insert(payload)
        .select("id, code, type, status, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, accessibility")
        .single();

      if (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
          throw new Error("Esiste già un idrante censito con questo codice.");
        }
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
    const boundsPoints: L.LatLngTuple[] = [
      [userPosition.latitude, userPosition.longitude],
      ...closest.map((h) => [h.latitude, h.longitude] as L.LatLngTuple),
    ];
    setMapBounds(boundsPoints);
    setMessage(`Trovati i ${closest.length} idranti più vicini (entro ${Math.round(closest[closest.length - 1].distance)}m).`);
  }

  return (
    <main className="relative h-screen overflow-hidden bg-slate-50 text-slate-950">
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
                color: isClosest ? "#06b6d4" : (hydrant.status === "Non funzionante" ? "#e11d48" : "#10b981"),
                fillOpacity: isClosest ? 0.3 : 0.1,
                weight: isClosest ? 2 : 1,
              }}
            />
          );
        })}
      </MapContainer>

      <section className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-2xl shadow-blue-900/10 backdrop-blur-xl transition-all">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
              <Siren size={22} aria-hidden="true" />
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
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:scale-105 hover:border-blue-300 hover:text-blue-600 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Cerca idranti vicini"
              title="Cerca idranti vicini"
            >
              <Search size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={createHydrantAtCurrentPosition}
              disabled={!userPosition}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 hover:from-cyan-400 hover:to-blue-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              <MapPinPlus size={18} aria-hidden="true" />
              <span className="whitespace-nowrap">Nuovo idrante qui</span>
            </button>
            <button
              type="button"
              onClick={locateUser}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:scale-105 hover:border-blue-300 hover:text-blue-600 active:scale-95"
              aria-label="Centra sulla posizione utente"
              title="Centra sulla posizione utente"
            >
              <LocateFixed size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <aside className="absolute inset-x-0 bottom-0 z-[500] max-h-[72vh] overflow-y-auto border-t border-white/60 bg-white/85 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl md:inset-y-5 md:left-auto md:right-5 md:max-h-none md:w-[450px] md:rounded-2xl md:border md:shadow-2xl md:shadow-blue-900/10">
        <div className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/50 px-4 py-4 backdrop-blur-md">
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
              Coordinate e Precisione
            </div>
            <p className="mt-1 font-mono text-sm text-slate-950">
              {draftPosition ? (
                <>
                  Lat: {draftPosition.latitude.toFixed(5)}, Lon: {draftPosition.longitude.toFixed(5)}
                  <br />
                  Precisione GPS: {draftPosition.accuracy ? `± ${Math.round(draftPosition.accuracy)} metri` : "N/D"}
                </>
              ) : (
                "Nessun punto selezionato"
              )}
            </p>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Identificazione</h3>
            <Field label="Codice idrante" required>
              <input
                required
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="Es. IDR-2026-001"
                className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
              />
            </Field>

            <div className="grid grid-cols-1 gap-5">
              <Field label="Comune">
                <input
                  disabled
                  value={municipalityId ? "Rilevato in automatico" : "Non disponibile"}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-slate-100 text-slate-500 px-4 text-base outline-none"
                />
              </Field>
              <Field label="Frazione / Località">
                <input
                  value={form.hamlet}
                  onChange={(event) => setForm({ ...form, hamlet: event.target.value })}
                  placeholder="Es. Centro Storico"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Via">
                  <input
                    value={form.street}
                    onChange={(event) => setForm({ ...form, street: event.target.value })}
                    placeholder="Es. Via Roma"
                    className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                  />
                </Field>
              </div>
              <div className="col-span-1">
                <Field label="Civico (opz.)">
                  <input
                    value={form.street_number}
                    onChange={(event) => setForm({ ...form, street_number: event.target.value })}
                    placeholder="Es. 15/A"
                    className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Tipologia</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              {["Soprasuolo", "Sottosuolo", "Parete"].map((typeOption) => (
                <label key={typeOption} className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                  <input
                    type="radio"
                    name="type"
                    value={typeOption}
                    checked={form.type === typeOption}
                    onChange={() => setForm({ ...form, type: typeOption as HydrantType })}
                    className="h-6 w-6 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  {typeOption}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Attacchi</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              {["UNI 45", "UNI 70", "UNI 100"].map((connection) => (
                <label key={connection} className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.connections.includes(connection)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, connections: [...form.connections, connection] });
                      } else {
                        setForm({ ...form, connections: form.connections.filter((c) => c !== connection) });
                      }
                    }}
                    className="h-6 w-6 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  {connection}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Stato Funzionale</h3>
            <div className="flex flex-col gap-4">
              {["Funzionante", "Non funzionante", "Da verificare"].map((statusOption) => (
                <label key={statusOption} className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                  <input
                    type="radio"
                    name="status"
                    value={statusOption}
                    checked={form.status === statusOption}
                    onChange={() => setForm({ ...form, status: statusOption as HydrantStatus })}
                    className="h-6 w-6 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  {statusOption}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Cartello di Segnalazione</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                <input
                  type="radio"
                  name="sign_present"
                  checked={form.sign_present === true}
                  onChange={() => setForm({ ...form, sign_present: true })}
                  className="h-6 w-6 text-red-600 focus:ring-red-500 border-slate-300"
                />
                Presente
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                <input
                  type="radio"
                  name="sign_present"
                  checked={form.sign_present === false}
                  onChange={() => setForm({ ...form, sign_present: false })}
                  className="h-6 w-6 text-red-600 focus:ring-red-500 border-slate-300"
                />
                Assente
              </label>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Accessibilità</h3>
            <div className="flex flex-col gap-4">
              {[
                "Accessibile a tutti i mezzi",
                "Accessibile ai camion (strada > 3,5m)",
                "Solo mezzi leggeri"
              ].map((accessOption) => (
                <label key={accessOption} className="flex items-center gap-3 cursor-pointer text-base font-medium text-slate-700">
                  <input
                    type="radio"
                    name="accessibility"
                    value={accessOption}
                    checked={form.accessibility === accessOption}
                    onChange={() => setForm({ ...form, accessibility: accessOption })}
                    className="h-6 w-6 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  {accessOption}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Documentazione Fotografica <span className="text-red-500 ml-1" aria-hidden="true">*</span></h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:bg-slate-100 hover:border-slate-400">
                {form.photoCloseUp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(form.photoCloseUp)} alt="Ravvicinata" className="h-20 w-full object-contain mb-3 rounded-md" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-500 mb-3">
                    <ImageUp size={24} aria-hidden="true" />
                  </div>
                )}
                <span className="line-clamp-2 text-sm font-semibold text-slate-700">Ravvicinata</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) =>
                    setForm({ ...form, photoCloseUp: event.target.files?.[0] ?? null })
                  }
                />
              </label>

              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:bg-slate-100 hover:border-slate-400">
                {form.photoPanoramic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(form.photoPanoramic)} alt="Panoramica" className="h-20 w-full object-contain mb-3 rounded-md" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-500 mb-3">
                    <ImageUp size={24} aria-hidden="true" />
                  </div>
                )}
                <span className="line-clamp-2 text-sm font-semibold text-slate-700">Panoramica</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) =>
                    setForm({ ...form, photoPanoramic: event.target.files?.[0] ?? null })
                  }
                />
              </label>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Note Aggiuntive</h3>
            <Field label="Dettagli operativi">
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={4}
                placeholder="Accessibilita, pressione, manutenzioni, riferimenti..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-base font-bold text-white shadow-lg shadow-teal-500/25 transition-all hover:scale-[1.02] hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                Salvataggio in corso...
              </>
            ) : (
              <>
                <Save size={22} aria-hidden="true" />
                Salva idrante
              </>
            )}
          </button>
        </form>
      </aside>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </span>
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
