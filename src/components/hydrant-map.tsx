"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Hydrant, HydrantCondition, HydrantFormState, HydrantStatus, HydrantType } from "@/types/hydrant";

const DEFAULT_CENTER: LatLngExpression = [41.9028, 12.4964];
const STATUS_LABELS: Record<HydrantStatus, string> = {
  Funzionante: "Funzionante",
  "Non funzionante": "Non funzionante",
  "Da verificare": "Da verificare",
};

const SAMPLE_STREETS = [
  "Via Roma",
  "Via Garibaldi",
  "Via Dante Alighieri",
  "Corso Vittorio Emanuele",
  "Via Giuseppe Mazzini",
  "Via Stazione",
  "Via Matteotti",
  "Via Marconi",
  "Via Verdi",
  "Via Veneto",
  "Via Nazionale",
  "Via Cavour",
  "Via Trieste",
  "Via Milano",
  "Via Torino",
];

const emptyForm: HydrantFormState = {
  code: "",
  hamlet: "",
  street: "",
  street_number: "",
  type: "Soprasuolo",
  connections: [],
  status: "Funzionante",
  condition: "Buono",
  dn: "DN 80",
  caps_present: true,
  caps_quantity: 2,
  chains_present: true,
  chains_quantity: 2,
  attached_pit: false,
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
  const [currentMunicipality, setCurrentMunicipality] = useState<string | null>(null);
  const [currentProvince, setCurrentProvince] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const photoCloseUpRef = useRef<HTMLInputElement>(null);
  const photoPanoramicRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(
    () => ({
      total: hydrants.length,
      working: hydrants.filter((hydrant) => hydrant.status === "Funzionante").length,
      broken: hydrants.filter((hydrant) => hydrant.status === "Non funzionante").length,
      review: hydrants.filter((hydrant) => hydrant.status === "Da verificare").length,
    }),
    [hydrants],
  );

  useEffect(() => {
    if (!userPosition) return;
    const { latitude, longitude } = userPosition;
    async function reverseGeocodeUser() {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.address) {
            const address = data.address;
            const municipality = address.city || address.town || address.village || address.hamlet || address.municipality || "";
            if (municipality) {
              setCurrentMunicipality(municipality);
            }
            const province = address.county || address.state_district || "";
            if (province) {
              setCurrentProvince(province);
            }
          }
        }
      } catch (error) {
        console.error("Errore nel reverse geocoding della posizione utente:", error);
      }
    }
    reverseGeocodeUser();
  }, [userPosition]);

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
        .select("id, code, type, status, condition, dn, caps_present, caps_quantity, chains_present, chains_quantity, attached_pit, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, accessibility")
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
    setIsDrawerOpen(true);
    setMessage("Scheda aperta sulla posizione GPS. Recupero indirizzo in corso...");
    setCurrentMunicipality(null);
    setCurrentProvince("");

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
          if (hamlet) {
            setCurrentMunicipality(hamlet);
          }
          const province = address.county || address.state_district || "";
          if (province) {
            setCurrentProvince(province);
          }
          
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

  async function correctDraftPosition(position: { latitude: number; longitude: number }) {
    if (!draftPosition) {
      setMessage("Premi Nuovo idrante qui prima di correggere manualmente la posizione.");
      return;
    }

    setDraftPosition(position);
    setIsDrawerOpen(true);
    setMessage("Posizione corretta manualmente sulla mappa. Recupero indirizzo...");
    setCurrentMunicipality(null);
    setCurrentProvince("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.latitude}&lon=${position.longitude}`
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
          if (hamlet) {
            setCurrentMunicipality(hamlet);
          }
          const province = address.county || address.state_district || "";
          if (province) {
            setCurrentProvince(province);
          }
          setMessage("Posizione e indirizzo aggiornati.");
          return;
        }
      }
      setMessage("Posizione corretta manualmente. Dettagli indirizzo non disponibili.");
    } catch {
      setMessage("Posizione corretta manualmente. Errore nel recupero dell'indirizzo.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftPosition) {
      setMessage("Seleziona prima un punto sulla mappa.");
      return;
    }

    if (!form.street.trim()) {
      setMessage("Inserisci la via.");
      return;
    }

    if (!supabase) {
      setMessage("Supabase non configurato: aggiungi le variabili ambiente.");
      return;
    }

    setIsSaving(true);
    setMessage("Salvataggio scheda tecnica...");

    try {
      // 1. Salvataggio idrante con i nuovi campi tecnici
      const payload = {
        type: form.type,
        status: form.status,
        condition: form.condition,
        dn: form.dn || null,
        caps_present: form.caps_present,
        caps_quantity: form.caps_present ? form.caps_quantity : 0,
        chains_present: form.chains_present,
        chains_quantity: form.chains_present ? form.chains_quantity : 0,
        attached_pit: form.attached_pit,
        notes: form.notes.trim() || null,
        latitude: draftPosition.latitude,
        longitude: draftPosition.longitude,
        municipality_id: municipalityId,
        codice_istat: currentMunicipality || null,
        hamlet: form.hamlet.trim() || null,
        street: form.street.trim() || null,
        street_number: form.street_number.trim() || null,
        connections: form.connections,
        sign_present: form.sign_present,
      };

      console.log("=== DEBUG SALVATAGGIO IDRANTE ===");
      console.log("Payload inviato a Supabase (Tabella hydrants):", payload);
      console.log("Valore di form.photoCloseUp:", form.photoCloseUp);
      console.log("Valore di form.photoPanoramic:", form.photoPanoramic);

      const { data: newHydrant, error: insertError } = await supabase
        .from("hydrants")
        .insert(payload)
        .select("id, code, type, status, condition, dn, caps_present, caps_quantity, chains_present, chains_quantity, attached_pit, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, accessibility")
        .single();

      if (insertError) {
        throw insertError;
      }

      // 2. Upload foto (se presenti) usando il codice generato
      const generatedCode = newHydrant.code;
      let photoUrl: string | null = null;
      let notesWithPhoto = form.notes.trim();
      let photoUpdated = false;

      if (form.photoPanoramic) {
        const pathPanoramic = buildPhotoPath(form.photoPanoramic, generatedCode + '-panoramica');
        const { error: uploadErrorPanoramic } = await supabase.storage
          .from("hydrant-photos")
          .upload(pathPanoramic, form.photoPanoramic, { upsert: false });

        if (!uploadErrorPanoramic) {
          const { data: dataPanoramic } = supabase.storage.from("hydrant-photos").getPublicUrl(pathPanoramic);
          photoUrl = dataPanoramic.publicUrl;
          photoUpdated = true;
        }
      }

      if (form.photoCloseUp) {
        const pathCloseUp = buildPhotoPath(form.photoCloseUp, generatedCode + '-ravvicinata');
        const { error: uploadErrorCloseUp } = await supabase.storage
          .from("hydrant-photos")
          .upload(pathCloseUp, form.photoCloseUp, { upsert: false });

        if (!uploadErrorCloseUp) {
          const { data: dataCloseUp } = supabase.storage.from("hydrant-photos").getPublicUrl(pathCloseUp);
          notesWithPhoto = notesWithPhoto 
            ? `${notesWithPhoto}\n\n[Foto Ravvicinata]: ${dataCloseUp.publicUrl}` 
            : `[Foto Ravvicinata]: ${dataCloseUp.publicUrl}`;
          photoUpdated = true;
        }
      }

      let finalHydrant = newHydrant;

      // 3. Aggiornamento idrante se sono state caricate foto
      if (photoUpdated) {
        const { data: updatedHydrant, error: updateError } = await supabase
          .from("hydrants")
          .update({
            photo_url: photoUrl || newHydrant.photo_url,
            notes: notesWithPhoto || null
          })
          .eq("id", newHydrant.id)
          .select("id, code, type, status, condition, dn, caps_present, caps_quantity, chains_present, chains_quantity, attached_pit, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, accessibility")
          .single();

        if (!updateError && updatedHydrant) {
          finalHydrant = updatedHydrant;
        }
      }

      setHydrants((current) => [finalHydrant as Hydrant, ...current]);
      setDraftPosition(null);
      setIsDrawerOpen(false);
      setForm(emptyForm);
      setCurrentMunicipality(null);
      setCurrentProvince("");
      
      // Clear file inputs in DOM
      if (photoCloseUpRef.current) photoCloseUpRef.current.value = "";
      if (photoPanoramicRef.current) photoPanoramicRef.current.value = "";

      setMessage("Idrante salvato con successo!");
      setTimeout(() => {
        setMessage("Tocca la mappa per censire un nuovo idrante.");
      }, 4000);
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
                {/* Titolo */}
                <h3 className="text-sm font-bold text-slate-900 leading-tight uppercase tracking-wider">
                  {hydrant.code ? `IDRANTE ${hydrant.code}` : "IDRANTE"}
                </h3>

                {/* Via e numero civico */}
                {(hydrant.street || hydrant.street_number) && (
                  <p className="text-sm font-medium text-slate-700 leading-snug">
                    {hydrant.street}
                    {hydrant.street && hydrant.street_number ? ` ${hydrant.street_number}` : hydrant.street_number}
                  </p>
                )}

                {/* Attacchi */}
                {hydrant.connections && hydrant.connections.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Attacchi:</span>
                    <p className="text-sm font-semibold text-slate-800">
                      {hydrant.connections.join(" • ")}
                    </p>
                  </div>
                )}

                {/* Stato funzionale */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stato:</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold mt-0.5 ${
                    hydrant.status === "Funzionante"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : hydrant.status === "Non funzionante"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      hydrant.status === "Funzionante"
                        ? "bg-emerald-500"
                        : hydrant.status === "Non funzionante"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`} />
                    {STATUS_LABELS[hydrant.status]}
                  </span>
                </div>

                {/* Foto */}
                {hydrant.photo_url && (
                  <div className="pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hydrant.photo_url}
                      alt={`Foto idrante ${hydrant.code}`}
                      className="h-28 w-full rounded-lg object-cover shadow-sm border border-slate-100"
                    />
                  </div>
                )}

                {/* Pulsante Apri scheda */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPosition({
                        latitude: hydrant.latitude,
                        longitude: hydrant.longitude,
                      });
                      setIsDrawerOpen(true);
                      setForm({
                        code: hydrant.code,
                        hamlet: hydrant.hamlet || "",
                        street: hydrant.street || "",
                        street_number: hydrant.street_number || "",
                        type: hydrant.type,
                        connections: hydrant.connections || [],
                        status: hydrant.status,
                        condition: hydrant.condition || "Buono",
                        dn: hydrant.dn || "DN 80",
                        caps_present: hydrant.caps_present !== undefined && hydrant.caps_present !== null ? hydrant.caps_present : true,
                        caps_quantity: hydrant.caps_quantity ?? 2,
                        chains_present: hydrant.chains_present !== undefined && hydrant.chains_present !== null ? hydrant.chains_present : true,
                        chains_quantity: hydrant.chains_quantity ?? 2,
                        attached_pit: hydrant.attached_pit !== undefined && hydrant.attached_pit !== null ? hydrant.attached_pit : false,
                        sign_present: hydrant.sign_present !== undefined ? hydrant.sign_present : null,
                        accessibility: hydrant.accessibility || "",
                        notes: hydrant.notes || "",
                        photoCloseUp: null,
                        photoPanoramic: null,
                      });
                    }}
                    className="w-full text-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-1.5 transition"
                  >
                    Apri scheda
                  </button>
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

      {/* Header compatto - logo, utilities e pulsante nuovo idrante */}
      <section className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/20">
            <Siren size={16} aria-hidden="true" />
          </div>
          <span className="hidden text-sm font-bold tracking-tight text-slate-900 sm:block">IDRANTYA</span>
          <span className="sr-only">{message}</span>
          <div className="mx-1 hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <button
            type="button"
            onClick={findClosestHydrants}
            disabled={!userPosition || hydrants.length === 0}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            aria-label="Cerca idranti vicini"
            title="Cerca idranti vicini"
          >
            <Search size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={locateUser}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600 active:scale-95"
            aria-label="Centra sulla posizione utente"
            title="Centra sulla posizione utente"
          >
            <LocateFixed size={15} aria-hidden="true" />
          </button>
          {!draftPosition && (
            <button
              type="button"
              onClick={createHydrantAtCurrentPosition}
              disabled={!userPosition}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 px-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-600 active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:px-3"
              aria-label="Nuovo idrante"
              title="Nuovo idrante qui (usa posizione GPS)"
            >
              <MapPinPlus size={15} className="shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Nuovo</span>
            </button>
          )}
        </div>
      </section>

      <aside className={`absolute inset-x-0 bottom-0 z-[450] max-h-[90vh] flex flex-col rounded-t-3xl border-t border-slate-200/80 bg-slate-50 shadow-[0_-12px_40px_rgb(0,0,0,0.15)] md:inset-y-4 md:left-auto md:right-4 md:max-h-none md:w-[460px] md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:translate-y-0 ${isDrawerOpen ? "translate-y-0" : "translate-y-[calc(100%-80px)]"}`}>
        <DrawerHandle isOpen={isDrawerOpen} onToggle={() => setIsDrawerOpen(prev => !prev)}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/20">
                <MapPinPlus size={16} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Catasto operativo</p>
                <h2 className="text-base font-bold text-slate-900">Scheda tecnica</h2>
                <p className="text-xs font-semibold text-blue-700 mt-0.5">
                  {currentMunicipality ? `Comune di ${currentMunicipality}` : "Ricerca Comune..."}
                </p>
              </div>
            </div>
            {draftPosition && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftPosition(null);
                  setIsDrawerOpen(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                aria-label="Annulla selezione"
                title="Annulla selezione"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </DrawerHandle>

        <div className="overflow-y-auto flex-1">
          <div className="border-b border-slate-200 px-4 py-3 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Statistiche {currentMunicipality ? `Comune di ${currentMunicipality}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
            <Stat icon={<Database size={16} />} label="Totale idranti" value={stats.total} />
            <Stat icon={<ShieldCheck size={16} />} label="Funzionanti" value={stats.working} />
            <Stat icon={<X size={16} />} label="Non funzionanti" value={stats.broken} />
            <Stat icon={<Crosshair size={16} />} label="Da verificare" value={stats.review} />
          </div>
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
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPinPlus size={16} aria-hidden="true" />
              Posizione GPS
            </div>
            <div className="mt-2 space-y-2 text-sm text-slate-950">
              {draftPosition ? (
                <>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Latitudine:</span>
                    <span className="font-mono">{draftPosition.latitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Longitudine:</span>
                    <span className="font-mono">{draftPosition.longitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Precisione GPS:</span>
                    <span>{draftPosition.accuracy ? `±${Math.round(draftPosition.accuracy)} metri` : "N/D"}</span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 italic">Acquisizione posizione in corso...</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs">2</span>
              Identificazione
            </h3>

            <div className="grid grid-cols-1 gap-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Comune">
                    <input
                      value={currentMunicipality || ""}
                      onChange={(event) => setCurrentMunicipality(event.target.value)}
                      placeholder="Ricerca Comune..."
                      className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                    />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="Provincia">
                    <input
                      value={currentProvince}
                      onChange={(event) => setCurrentProvince(event.target.value)}
                      placeholder="Es. VR"
                      className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                    />
                  </Field>
                </div>
              </div>
              <Field label="Frazione / Località">
                <input
                  value={form.hamlet}
                  onChange={(event) => setForm({ ...form, hamlet: event.target.value })}
                  placeholder="Es. Centro Storico"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Via (Codificata)">
                  <StreetCombobox
                    value={form.street}
                    onChange={(val) => setForm({ ...form, street: val })}
                    placeholder="Seleziona o digita via..."
                  />
                </Field>
              </div>
              <div className="col-span-1">
                <Field label="Civico (opz.)">
                  <input
                    value={form.street_number}
                    onChange={(event) => setForm({ ...form, street_number: event.target.value })}
                    placeholder="Es. 15/A"
                    className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Sezione Tipologia e Specifiche Tecniche */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Tipologia & Specifiche Tecniche</h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Tipo Idrante</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  {["Soprasuolo", "Sottosuolo", "Parete"].map((typeOption) => (
                    <label key={typeOption} className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
                      <input
                        type="radio"
                        name="type"
                        value={typeOption}
                        checked={form.type === typeOption}
                        onChange={() => setForm({ ...form, type: typeOption as HydrantType })}
                        className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      {typeOption}
                    </label>
                  ))}
                </div>
              </div>

              {/* Diametro Nominale (DN) */}
              <Field label="Diametro Nominale (DN)">
                <select
                  value={form.dn}
                  onChange={(e) => setForm({ ...form, dn: e.target.value })}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value="DN 80">DN 80 (Standard)</option>
                  <option value="DN 100">DN 100</option>
                  <option value="DN 150">DN 150</option>
                  <option value="DN 200">DN 200</option>
                </select>
              </Field>

              {/* Tappi */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                <span className="block text-sm font-semibold text-slate-800">Tappi di Chiusura</span>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                      <input
                        type="radio"
                        name="caps_present"
                        checked={form.caps_present === true}
                        onChange={() => setForm({ ...form, caps_present: true })}
                        className="h-5 w-5 text-blue-600"
                      />
                      SI
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                      <input
                        type="radio"
                        name="caps_present"
                        checked={form.caps_present === false}
                        onChange={() => setForm({ ...form, caps_present: false })}
                        className="h-5 w-5 text-blue-600"
                      />
                      NO
                    </label>
                  </div>
                  {form.caps_present && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Quantità:</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={form.caps_quantity}
                        onChange={(e) => setForm({ ...form, caps_quantity: parseInt(e.target.value) || 0 })}
                        className="h-10 w-16 rounded-md border border-slate-300 bg-white text-center font-bold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Catenelle */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                <span className="block text-sm font-semibold text-slate-800">Catenelle di Sicurezza</span>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                      <input
                        type="radio"
                        name="chains_present"
                        checked={form.chains_present === true}
                        onChange={() => setForm({ ...form, chains_present: true })}
                        className="h-5 w-5 text-blue-600"
                      />
                      SI
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                      <input
                        type="radio"
                        name="chains_present"
                        checked={form.chains_present === false}
                        onChange={() => setForm({ ...form, chains_present: false })}
                        className="h-5 w-5 text-blue-600"
                      />
                      NO
                    </label>
                  </div>
                  {form.chains_present && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Quantità:</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={form.chains_quantity}
                        onChange={(e) => setForm({ ...form, chains_quantity: parseInt(e.target.value) || 0 })}
                        className="h-10 w-16 rounded-md border border-slate-300 bg-white text-center font-bold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Pozzetto annesso */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                <span className="block text-sm font-semibold text-slate-800">Pozzetto Annesso</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                    <input
                      type="radio"
                      name="attached_pit"
                      checked={form.attached_pit === true}
                      onChange={() => setForm({ ...form, attached_pit: true })}
                      className="h-5 w-5 text-blue-600"
                    />
                    SI
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-base font-medium text-slate-700">
                    <input
                      type="radio"
                      name="attached_pit"
                      checked={form.attached_pit === false}
                      onChange={() => setForm({ ...form, attached_pit: false })}
                      className="h-5 w-5 text-blue-600"
                    />
                    NO
                  </label>
                </div>
              </div>

            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Attacchi</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {["UNI 45", "UNI 70", "UNI 100"].map((connection) => (
                <label key={connection} className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
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
                    className="h-6 w-6 shrink-0 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  {connection}
                </label>
              ))}
            </div>
          </div>

          {/* Sezione Stato e Funzionalità */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Stato & Conservazione</h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Stato Funzionale</label>
                <div className="flex flex-col gap-2">
                  {["Funzionante", "Non funzionante", "Da verificare"].map((statusOption) => (
                    <label key={statusOption} className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
                      <input
                        type="radio"
                        name="status"
                        value={statusOption}
                        checked={form.status === statusOption}
                        onChange={() => setForm({ ...form, status: statusOption as HydrantStatus })}
                        className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      {statusOption}
                    </label>
                  ))}
                </div>
              </div>

              {/* Stato di Conservazione (Nuovo / Buono / Pessimo) */}
              <Field label="Stato di Conservazione">
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value as HydrantCondition })}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 text-base font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value="Nuovo">Nuovo</option>
                  <option value="Buono">Buono</option>
                  <option value="Pessimo">Pessimo</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Cartello di Segnalazione</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
                <input
                  type="radio"
                  name="sign_present"
                  checked={form.sign_present === true}
                  onChange={() => setForm({ ...form, sign_present: true })}
                  className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                Presente
              </label>
              <label className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
                <input
                  type="radio"
                  name="sign_present"
                  checked={form.sign_present === false}
                  onChange={() => setForm({ ...form, sign_present: false })}
                  className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                Assente
              </label>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Accessibilità</h3>
            <div className="flex flex-col gap-2">
              {[
                "Accessibile a tutti i mezzi",
                "Accessibile ai camion (strada > 3,5m)",
                "Solo mezzi leggeri"
              ].map((accessOption) => (
                <label key={accessOption} className="flex min-h-[44px] items-center gap-3 cursor-pointer rounded-lg px-2 py-2 text-base font-medium text-slate-700 active:bg-slate-100 transition-colors">
                  <input
                    type="radio"
                    name="accessibility"
                    value={accessOption}
                    checked={form.accessibility === accessOption}
                    onChange={() => setForm({ ...form, accessibility: accessOption })}
                    className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  {accessOption}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              Documentazione Fotografica <span className="text-xs text-slate-400 font-normal ml-1">(Opzionale)</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => {
                  console.log("Triggered click su input Ravvicinata");
                  photoCloseUpRef.current?.click();
                }}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:bg-slate-100 hover:border-slate-400"
              >
                {form.photoCloseUp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(form.photoCloseUp)} alt="Ravvicinata" className="h-20 w-full object-contain mb-3 rounded-md" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-500 mb-3">
                    <ImageUp size={24} aria-hidden="true" />
                  </div>
                )}
                <span className="line-clamp-2 text-sm font-semibold text-slate-700">Ravvicinata</span>
              </div>

              <div
                onClick={() => {
                  console.log("Triggered click su input Panoramica");
                  photoPanoramicRef.current?.click();
                }}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:bg-slate-100 hover:border-slate-400"
              >
                {form.photoPanoramic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(form.photoPanoramic)} alt="Panoramica" className="h-20 w-full object-contain mb-3 rounded-md" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-500 mb-3">
                    <ImageUp size={24} aria-hidden="true" />
                  </div>
                )}
                <span className="line-clamp-2 text-sm font-semibold text-slate-700">Panoramica</span>
              </div>

              {/* Hidden Inputs located outside the clickable areas */}
              <input
                id="photoCloseUpInput"
                ref={photoCloseUpRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  console.log("Evento onChange (Ravvicinata) - files list:", event.target.files);
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    console.log("File catturato (Ravvicinata):", { name: file.name, size: file.size, type: file.type });
                  }
                  setForm(prev => ({ ...prev, photoCloseUp: file }));
                  // Reset the input value so selecting the same file or taking a new photo triggers onChange again
                  event.target.value = '';
                }}
              />

              <input
                id="photoPanoramicInput"
                ref={photoPanoramicRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  console.log("Evento onChange (Panoramica) - files list:", event.target.files);
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    console.log("File catturato (Panoramica):", { name: file.name, size: file.size, type: file.type });
                  }
                  setForm(prev => ({ ...prev, photoPanoramic: file }));
                  // Reset the input value so selecting the same file or taking a new photo triggers onChange again
                  event.target.value = '';
                }}
              />
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

          <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
          </div>
        </form>
        </div>
      </aside>
    </main>
  );
}

/** Drawer handle with touch drag support for mobile bottom sheet */
function DrawerHandle({
  isOpen,
  onToggle,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (startY.current === null || currentY.current === null) return;
    const delta = currentY.current - startY.current;
    const THRESHOLD = 50;

    if (isOpen && delta > THRESHOLD) {
      // Swipe down → close
      onToggle();
    } else if (!isOpen && delta < -THRESHOLD) {
      // Swipe up → open
      onToggle();
    }

    startY.current = null;
    currentY.current = null;
  }, [isOpen, onToggle]);

  return (
    <div
      className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pt-5 pb-4 backdrop-blur-md md:pt-4 md:cursor-auto cursor-pointer select-none touch-pan-y"
      onClick={onToggle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle pill for mobile */}
      <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-300 rounded-full" />
      {children}
    </div>
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

/** Searchable Street Combobox / Autocomplete */
function StreetCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredStreets = useMemo(() => {
    if (!value.trim()) return SAMPLE_STREETS;
    return SAMPLE_STREETS.filter((s) =>
      s.toLowerCase().includes(value.toLowerCase())
    );
  }, [value]);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder || "Cerca o inserisci via..."}
          className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 pr-10 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-3 text-slate-400"
        />
      </div>

      {isOpen && filteredStreets.length > 0 && (
        <ul className="absolute z-[600] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg backdrop-blur-md">
          {filteredStreets.map((street) => (
            <li
              key={street}
              onMouseDown={() => {
                onChange(street);
                setIsOpen(false);
              }}
              className="cursor-pointer px-4 py-2 text-sm text-slate-800 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100"
            >
              {street}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
