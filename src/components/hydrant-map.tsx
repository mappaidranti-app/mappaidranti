"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
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
  Pencil,
  Camera,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CappellottoStatus, Hydrant, HydrantCondition, HydrantFormState, HydrantStatus, HydrantType, PitStatus } from "@/types/hydrant";

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
  street: "",
  street_number: "",
  type: "Soprasuolo",
  connections: [],
  status: "Funzionante",
  condition: "DISCRETO",
  uni45Count: 0,
  uni70Count: 0,
  missingCaps: 0,
  missingChains: 0,
  sign_present: null,
  accessibility: "",
  notes: "",
  has_pit: null,
  pit_status: null,
  needs_painting: null,
  cappellotto_status: null,
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

function buildPhotoPath(file: File) {
  const extension = file.name.split(".").pop() || "jpg";
  const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  return cleanFileName;
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
  
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [closestHydrantsIds, setClosestHydrantsIds] = useState<Set<string | number>>(new Set()); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [municipalityId, setMunicipalityId] = useState<string | null>(null);
  const [currentMunicipality, setCurrentMunicipality] = useState<string | null>(null);
  const [currentProvince, setCurrentProvince] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedHydrant, setSelectedHydrant] = useState<Hydrant | null>(null);
  const [isClosestListOpen, setIsClosestListOpen] = useState(false);
  const [closestHydrantsList, setClosestHydrantsList] = useState<(Hydrant & { distance: number })[]>([]);
  const [fileRavvicinata, setFileRavvicinata] = useState<File | null>(null);
  const [filePanoramica, setFilePanoramica] = useState<File | null>(null);
  const [filePozzetto, setFilePozzetto] = useState<File | null>(null);
  const [previewRavvicinata, setPreviewRavvicinata] = useState<string | null>(null);
  const [previewPanoramica, setPreviewPanoramica] = useState<string | null>(null);
  const [previewPozzetto, setPreviewPozzetto] = useState<string | null>(null);
  const inputRavvicinataRef = useRef<HTMLInputElement>(null);
  const inputPanoramicaRef = useRef<HTMLInputElement>(null);
  const inputPozzettoRef = useRef<HTMLInputElement>(null);

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
          .select("municipality_id, role")
          .eq("id", sessionData.session.user.id)
          .single();
        if (profile?.municipality_id) {
          setMunicipalityId(profile.municipality_id);
        }
        if (profile?.role === "referent") {
          setIsAdmin(true);
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
    }

    loadHydrants();
  }, []);

  // Intercetta il tasto Indietro per chiudere le modal invece di uscire
  useEffect(() => {
    const handlePopState = () => {
      if (selectedHydrant || isDrawerOpen || isClosestListOpen || draftPosition) {
        // Se c'è una modal aperta, impediamo di andare indietro ripristinando lo stato
        window.history.pushState(null, "", window.location.href);
        setSelectedHydrant(null);
        setIsDrawerOpen(false);
        setIsClosestListOpen(false);
        setDraftPosition(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedHydrant, isDrawerOpen, isClosestListOpen, draftPosition]);

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

  async function fetchAddress(lat: number, lon: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      
      const comune = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "";
      const frazione = data.address?.hamlet || data.address?.suburb || "";
      const strada = data.address?.road || data.address?.pedestrian || "";
      const civico = data.address?.house_number || "";
      const provinciaStr = data.address?.county || data.address?.province || "";

      setForm((prev) => ({
        ...prev,
        hamlet: frazione,
        street: strada,
        street_number: civico,
      }));
      
      setCurrentMunicipality(comune || "Comune non rilevato");
      setCurrentProvince(provinciaStr);
      setMessage("Indirizzo recuperato con successo.");
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      setMessage("Impossibile recuperare l'indirizzo. Inserisci i dati manualmente.");
    }
  }

  function handleNuovoIdrante() {
    if (!navigator.geolocation) {
      setMessage("Geolocalizzazione non supportata.");
      setIsDrawerOpen(true);
      return;
    }

    setMessage("Rilevamento posizione GPS in corso...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserPosition({ ...coords, accuracy: position.coords.accuracy });
        setDraftPosition(coords);
        setIsDrawerOpen(true);
        fetchAddress(coords.latitude, coords.longitude);
      },
      (error) => {
        console.warn("Errore GPS:", error);
        setMessage("Errore GPS. Tocca la mappa per inserire manualmente.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function correctDraftPosition(position: { latitude: number; longitude: number }) {
    setDraftPosition(position);
    setIsDrawerOpen(true);
    setMessage("Posizione impostata. Recupero indirizzo...");
    fetchAddress(position.latitude, position.longitude);
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
      // 1. Salvataggio record idrante (SOLO colonne verificate nel DB)
      let calculatedDn = "";
      if (form.uni45Count > 0) calculatedDn += `UNI 45 (${form.uni45Count}) `;
      if (form.uni70Count > 0) calculatedDn += `UNI 70 (${form.uni70Count})`;
      calculatedDn = calculatedDn.trim();

      const payload = {
        type: form.type,
        status: form.status,
        condition: form.condition,
        dn: calculatedDn || null,
        caps_present: form.missingCaps === 0,
        caps_quantity: form.missingCaps,
        chains_present: form.missingChains === 0,
        chains_quantity: form.missingChains,
        notes: form.notes.trim() || null,
        latitude: draftPosition.latitude,
        longitude: draftPosition.longitude,
        municipality_id: municipalityId,
        hamlet: null,
        street: form.street.trim() || null,
        street_number: form.street_number.trim() || null,
        connections: form.connections,
        sign_present: form.sign_present,
        photo_url: null as string | null,
        code: form.code.trim() || null,
        has_pit: form.has_pit,
        pit_status: form.pit_status,
        needs_painting: form.needs_painting,
        pit_photo_url: null as string | null,
        cappellotto_status: form.cappellotto_status,
      };

      console.log("=== [IDRANTYA] DEBUG SALVATAGGIO IDRANTE ===");
      console.log("Payload DB:", JSON.stringify(payload, null, 2));
      console.log("fileRavvicinata:", fileRavvicinata ? `${fileRavvicinata.name} (${fileRavvicinata.size} bytes)` : "null");
      console.log("filePanoramica:", filePanoramica ? `${filePanoramica.name} (${filePanoramica.size} bytes)` : "null");
      console.log("filePozzetto:", filePozzetto ? `${filePozzetto.name} (${filePozzetto.size} bytes)` : "null");

      const { data: newHydrant, error: insertError } = await supabase
        .from("hydrants")
        .insert(payload)
        .select("id, code, type, status, condition, dn, caps_present, caps_quantity, chains_present, chains_quantity, attached_pit, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, has_pit, pit_inspectable, pit_photo_url, needs_painting")
        .single();

      if (insertError) {
        console.error("[IDRANTYA] Errore INSERT:", insertError);
        throw new Error(`Errore DB: ${insertError.message} (code: ${insertError.code})`);
      }

      console.log("[IDRANTYA] Idrante inserito con successo, id:", newHydrant.id, "code:", newHydrant.code);

      // 2. Upload foto — TOLLERANTE AI GUASTI: un errore foto non blocca il salvataggio
      let photoUrl: string | null = null;
      let pitPhotoUrl: string | null = null;
      let notesWithPhoto = form.notes.trim();
      let photoUpdated = false;

      // BUCKET NAME IN USE: "hydrant-photos"
      if (filePanoramica) {
        try {
          const pathPanoramic = buildPhotoPath(filePanoramica);
          console.log("[IDRANTYA] Bucket: 'hydrant-photos' | Upload panoramica su path:", pathPanoramic);
          const { error: uploadErrorPanoramic } = await supabase.storage
            .from("hydrant-photos")
            .upload(pathPanoramic, filePanoramica, { upsert: false });

          if (uploadErrorPanoramic) {
            const errMsg = `Bucket: 'hydrant-photos'\nPath: ${pathPanoramic}\nErrore: ${uploadErrorPanoramic.message}\nDettaglio: ${JSON.stringify(uploadErrorPanoramic)}`;
            console.warn("[IDRANTYA] Upload panoramica fallito:", errMsg);
            alert("⚠️ Errore Upload Foto Panoramica:\n\n" + errMsg);
          } else {
            const { data: dataPanoramic } = supabase.storage.from("hydrant-photos").getPublicUrl(pathPanoramic);
            photoUrl = dataPanoramic.publicUrl;
            photoUpdated = true;
            console.log("[IDRANTYA] Panoramica caricata:", photoUrl);
          }
        } catch (photoErr) {
          const errMsg = photoErr instanceof Error ? photoErr.message : JSON.stringify(photoErr);
          console.error("[IDRANTYA] Eccezione upload PANORAMICA — quota/permessi Supabase?", photoErr);
          alert("⚠️ Eccezione Upload Foto Panoramica:\n\n" + errMsg);
        }
      }

      if (fileRavvicinata) {
        try {
          const pathCloseUp = buildPhotoPath(fileRavvicinata);
          console.log("[IDRANTYA] Bucket: 'hydrant-photos' | Upload ravvicinata su path:", pathCloseUp);
          const { error: uploadErrorCloseUp } = await supabase.storage
            .from("hydrant-photos")
            .upload(pathCloseUp, fileRavvicinata, { upsert: false });

          if (uploadErrorCloseUp) {
            const errMsg = `Bucket: 'hydrant-photos'\nPath: ${pathCloseUp}\nErrore: ${uploadErrorCloseUp.message}\nDettaglio: ${JSON.stringify(uploadErrorCloseUp)}`;
            console.warn("[IDRANTYA] Upload ravvicinata fallito:", errMsg);
            alert("⚠️ Errore Upload Foto Ravvicinata:\n\n" + errMsg);
          } else {
            const { data: dataCloseUp } = supabase.storage.from("hydrant-photos").getPublicUrl(pathCloseUp);
            const closeUpUrl = dataCloseUp.publicUrl;
            notesWithPhoto = notesWithPhoto
              ? `${notesWithPhoto}\n\n[Foto Ravvicinata]: ${closeUpUrl}`
              : `[Foto Ravvicinata]: ${closeUpUrl}`;
            photoUpdated = true;
            console.log("[IDRANTYA] Ravvicinata caricata:", closeUpUrl);
          }
        } catch (photoErr) {
          const errMsg = photoErr instanceof Error ? photoErr.message : JSON.stringify(photoErr);
          console.error("[IDRANTYA] Eccezione upload RAVVICINATA — quota/permessi Supabase?", photoErr);
          alert("⚠️ Eccezione Upload Foto Ravvicinata:\n\n" + errMsg);
        }
      }

      if (filePozzetto) {
        try {
          const pathPozzetto = buildPhotoPath(filePozzetto);
          console.log("[IDRANTYA] Bucket: 'hydrant-photos' | Upload pozzetto su path:", pathPozzetto);
          const { error: uploadErrorPozzetto } = await supabase.storage
            .from("hydrant-photos")
            .upload(pathPozzetto, filePozzetto, { upsert: false });

          if (uploadErrorPozzetto) {
            const errMsg = `Bucket: 'hydrant-photos'\nPath: ${pathPozzetto}\nErrore: ${uploadErrorPozzetto.message}\nDettaglio: ${JSON.stringify(uploadErrorPozzetto)}`;
            console.warn("[IDRANTYA] Upload pozzetto fallito:", errMsg);
            alert("⚠️ Errore Upload Foto Pozzetto:\n\n" + errMsg);
          } else {
            const { data: dataPozzetto } = supabase.storage.from("hydrant-photos").getPublicUrl(pathPozzetto);
            pitPhotoUrl = dataPozzetto.publicUrl;
            photoUpdated = true;
            console.log("[IDRANTYA] Pozzetto caricato:", pitPhotoUrl);
          }
        } catch (photoErr) {
          const errMsg = photoErr instanceof Error ? photoErr.message : JSON.stringify(photoErr);
          console.error("[IDRANTYA] Eccezione upload POZZETTO — quota/permessi Supabase?", photoErr);
          alert("⚠️ Eccezione Upload Foto Pozzetto:\n\n" + errMsg);
        }
      }

      let finalHydrant = newHydrant;

      // 3. Aggiornamento URL foto nel record (opzionale)
      if (photoUpdated) {
        try {
          const { data: updatedHydrant, error: updateError } = await supabase
            .from("hydrants")
            .update({
              photo_url: photoUrl || newHydrant.photo_url,
              pit_photo_url: pitPhotoUrl || newHydrant.pit_photo_url,
              notes: notesWithPhoto || null,
            })
            .eq("id", newHydrant.id)
            .select("id, code, type, status, condition, dn, caps_present, caps_quantity, chains_present, chains_quantity, attached_pit, notes, latitude, longitude, photo_url, created_at, municipality_id, hamlet, street, street_number, connections, sign_present, has_pit, pit_inspectable, pit_photo_url, needs_painting")
            .single();

          if (updateError) {
            console.warn("[IDRANTYA] Errore UPDATE foto:", updateError.message);
          } else if (updatedHydrant) {
            finalHydrant = updatedHydrant;
          }
        } catch (updateErr) {
          console.warn("[IDRANTYA] Eccezione UPDATE foto:", updateErr);
        }
      }

      // 4. Aggiorna UI e resetta form
      setHydrants((current) => [finalHydrant as Hydrant, ...current]);
      setDraftPosition(null);
      setIsDrawerOpen(false);
      setForm(emptyForm);
      setCurrentMunicipality(null);
      setCurrentProvince("");

      // Clear file inputs state
      setFileRavvicinata(null);
      setFilePanoramica(null);
      setFilePozzetto(null);
      setPreviewRavvicinata(null);
      setPreviewPanoramica(null);
      setPreviewPozzetto(null);

      setMessage("✅ Idrante salvato con successo!");
      setTimeout(() => {
        setMessage("Tocca la mappa per censire un nuovo idrante.");
      }, 4000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("[IDRANTYA] Errore fatale handleSubmit:", msg);
      // Alert visibile su mobile per debug immediato
      alert("❌ Errore durante il salvataggio:\n\n" + msg);
      setMessage("Salvataggio non riuscito: " + msg);
    } finally {
      setIsSaving(false);
    }
  }

  function calculateDistanceHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio terrestre in metri
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
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

    // Calcola le distanze (in metri) usando la formula di Haversine
    const withDistances = hydrants.map((h) => ({
      ...h,
      distance: calculateDistanceHaversine(userPosition.latitude, userPosition.longitude, h.latitude, h.longitude),
    }));

    // Ordina per distanza e mostra i 5 più vicini
    withDistances.sort((a, b) => a.distance - b.distance);
    setClosestHydrantsList(withDistances.slice(0, 5));
    setIsClosestListOpen(true);
    setDraftPosition(null);
    setIsDrawerOpen(false);
    setSelectedHydrant(null);
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
          <Marker 
            position={[draftPosition.latitude, draftPosition.longitude]} 
            icon={draftIcon}
            draggable={true}
            eventHandlers={{
              dragstart: () => {
                setMessage("Trascina il pin nella posizione esatta...");
              },
              drag: (e) => {
                const pos = e.target.getLatLng();
                setDraftPosition((prev) => prev ? { ...prev, latitude: pos.lat, longitude: pos.lng } : null);
              },
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                setDraftPosition((prev) => prev ? { ...prev, latitude: pos.lat, longitude: pos.lng, accuracy: undefined } : null);
                fetchAddress(pos.lat, pos.lng);
                setMessage("Posizione aggiornata. Recupero indirizzo...");
              }
            }}
          >
            <Tooltip permanent direction="top" className="font-bold">
              📍 Trascina per posizionare
            </Tooltip>
          </Marker>
        )}

        {hydrants.map((hydrant) => (
          <Marker
            key={hydrant.id}
            position={[hydrant.latitude, hydrant.longitude]}
            icon={hydrantIcon}
            eventHandlers={{
              click: () => {
                setSelectedHydrant(hydrant);
              }
            }}
          >
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
            className="flex h-8 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 shadow-sm transition-all hover:bg-blue-100 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            📍 Idranti Vicini
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPinPlus size={16} aria-hidden="true" />
                Posizione GPS
              </div>
              {userPosition && (
                <button
                  type="button"
                  onClick={() => {
                    const coords = { latitude: userPosition.latitude, longitude: userPosition.longitude, accuracy: userPosition.accuracy };
                    setDraftPosition(coords);
                    fetchAddress(coords.latitude, coords.longitude);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 active:scale-95"
                >
                  📍 Ripristina da GPS
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2 text-sm text-slate-950">
              {draftPosition ? (
                <>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Latitudine:</span>
                      <span className="font-mono">{draftPosition.latitude.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Longitudine:</span>
                      <span className="font-mono">{draftPosition.longitude.toFixed(6)}</span>
                    </div>
                    {draftPosition.accuracy && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Precisione:</span>
                        <span>±{Math.round(draftPosition.accuracy)} m</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 italic">💡 Trascina il pin sulla mappa per correggere la posizione</p>
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

              {/* Attacchi UNI (DN) e Accessori Mappa */}
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                  <span className="block text-base font-semibold text-slate-800">Attacchi UNI</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600">UNI 45</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setForm(f => ({ ...f, uni45Count: Math.max(0, f.uni45Count - 1) }))} className="grid h-12 w-12 place-items-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:scale-95">-</button>
                        <span className="w-8 text-center text-xl font-bold">{form.uni45Count}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, uni45Count: f.uni45Count + 1 }))} className="grid h-12 w-12 place-items-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:scale-95">+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600">UNI 70</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setForm(f => ({ ...f, uni70Count: Math.max(0, f.uni70Count - 1) }))} className="grid h-12 w-12 place-items-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:scale-95">-</button>
                        <span className="w-8 text-center text-xl font-bold">{form.uni70Count}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, uni70Count: f.uni70Count + 1 }))} className="grid h-12 w-12 place-items-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:scale-95">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                  <span className="block text-base font-semibold text-slate-800">Tappi e Catenelle</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600">Tappi Mancanti</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setForm(f => ({ ...f, missingCaps: Math.max(0, f.missingCaps - 1) }))} className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 bg-white text-xl font-bold text-red-600 active:scale-95">-</button>
                        <span className="w-8 text-center text-xl font-bold">{form.missingCaps}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, missingCaps: f.missingCaps + 1 }))} className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 bg-white text-xl font-bold text-red-600 active:scale-95">+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600">Catene Mancanti</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setForm(f => ({ ...f, missingChains: Math.max(0, f.missingChains - 1) }))} className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 bg-white text-xl font-bold text-red-600 active:scale-95">-</button>
                        <span className="w-8 text-center text-xl font-bold">{form.missingChains}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, missingChains: f.missingChains + 1 }))} className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 bg-white text-xl font-bold text-red-600 active:scale-95">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-white p-4 space-y-4">
                  <span className="block text-lg font-black text-slate-800 flex items-center gap-2">
                    🕳️ Pozzetto Valvola (A terra)
                  </span>
                  
                  <div className="space-y-4">
                    <span className="block text-base font-semibold text-slate-700">Presenza Pozzetto</span>
                    <div className="flex items-center gap-4">
                      <label className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-lg font-bold text-slate-700 transition hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-100 has-[:checked]:text-blue-800">
                        <input
                          type="radio"
                          name="has_pit"
                          checked={form.has_pit === true}
                          onChange={() => setForm({ ...form, has_pit: true })}
                          className="hidden"
                        />
                        Presente
                      </label>
                      <label className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-lg font-bold text-slate-700 transition hover:border-red-400 has-[:checked]:border-red-600 has-[:checked]:bg-red-100 has-[:checked]:text-red-800">
                        <input
                          type="radio"
                          name="has_pit"
                          checked={form.has_pit === false}
                          onChange={() => setForm({ ...form, has_pit: false, pit_status: null })}
                          className="hidden"
                        />
                        Assente
                      </label>
                    </div>
                  </div>

                  {form.has_pit && (
                    <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                      <span className="block text-base font-semibold text-slate-700 mb-3">Stato Apertura Pozzetto</span>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700">
                          <input
                            type="radio"
                            name="pit_status"
                            checked={form.pit_status === "apre_facilmente"}
                            onChange={() => setForm({ ...form, pit_status: "apre_facilmente" })}
                            className="hidden"
                          />
                          Si apre facilmente
                        </label>
                        <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-red-400 has-[:checked]:border-red-600 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
                          <input
                            type="radio"
                            name="pit_status"
                            checked={form.pit_status === "bloccato"}
                            onChange={() => setForm({ ...form, pit_status: "bloccato" })}
                            className="hidden"
                          />
                          Bloccato / Duro
                        </label>
                        <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 has-[:checked]:border-slate-600 has-[:checked]:bg-slate-200 has-[:checked]:text-slate-800">
                          <input
                            type="radio"
                            name="pit_status"
                            checked={form.pit_status === "non_ispezionabile"}
                            onChange={() => setForm({ ...form, pit_status: "non_ispezionabile" })}
                            className="hidden"
                          />
                          Non ispezionabile
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {form.has_pit && form.pit_status && (
                    <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                      <span className="block text-base font-semibold text-slate-700 mb-2">📷 Foto interno pozzetto / valvola</span>
                      <div
                        className={`group relative flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all active:scale-[0.98] ${
                          filePozzetto ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100"
                        }`}
                        onClick={() => inputPozzettoRef.current?.click()}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          className="hidden"
                          ref={inputPozzettoRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFilePozzetto(file);
                              setPreviewPozzetto(URL.createObjectURL(file));
                            }
                          }}
                        />
                        {previewPozzetto ? (
                          <div className="absolute inset-0 overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewPozzetto} alt="Preview Pozzetto" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 grid place-items-center">
                              <span className="text-white font-semibold flex items-center gap-2"><Camera size={18} /> Cambia Foto</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-full bg-white p-3 shadow-sm text-blue-600">
                              <Camera size={24} />
                            </div>
                            <span className="text-sm font-semibold text-slate-600">Scatta o Scegli...</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-white p-4 space-y-4 mt-4">
                  <span className="block text-lg font-black text-slate-800 flex items-center gap-2">
                    🧢 Cappello Colonna Idrante
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700">
                      <input
                        type="radio"
                        name="cappellotto_status"
                        checked={form.cappellotto_status === "integro"}
                        onChange={() => setForm({ ...form, cappellotto_status: "integro" })}
                        className="hidden"
                      />
                      Presente e integro
                    </label>
                    <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-red-400 has-[:checked]:border-red-600 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
                      <input
                        type="radio"
                        name="cappellotto_status"
                        checked={form.cappellotto_status === "mancante"}
                        onChange={() => setForm({ ...form, cappellotto_status: "mancante" })}
                        className="hidden"
                      />
                      Mancante
                    </label>
                    <label className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-amber-400 has-[:checked]:border-amber-600 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-700">
                      <input
                        type="radio"
                        name="cappellotto_status"
                        checked={form.cappellotto_status === "danneggiato"}
                        onChange={() => setForm({ ...form, cappellotto_status: "danneggiato" })}
                        className="hidden"
                      />
                      Staccato / Danneggiato
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Stato & Conservazione</h3>
            
            <div className="space-y-6">
                <div>
                  <label className="mb-3 block text-base font-bold text-slate-800">Stato Funzionale</label>
                  <div className="grid grid-cols-1 gap-3">
                    {["Funzionante", "Non funzionante", "Da verificare"].map((statusOption) => (
                      <label key={statusOption} className="flex min-h-[56px] items-center gap-4 cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-3 text-lg font-semibold text-slate-700 transition hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
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

                <div>
                  <label className="mb-3 block text-base font-bold text-slate-800">Stato di Conservazione</label>
                  <div className="grid grid-cols-1 gap-3">
                    {["NUOVO", "DISCRETO", "SUFFICIENTE", "PESSIMO / DANNEGGIATO"].map((conditionOption) => (
                      <label key={conditionOption} className="flex min-h-[56px] items-center gap-4 cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-3 text-lg font-semibold text-slate-700 transition hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input
                          type="radio"
                          name="condition"
                          value={conditionOption}
                          checked={form.condition === conditionOption}
                          onChange={() => setForm({ ...form, condition: conditionOption as HydrantCondition })}
                          className="h-6 w-6 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        {conditionOption}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="mb-3 block text-base font-bold text-slate-800">Da Verniciare?</label>
                  <div className="flex items-center gap-6">
                    <label className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-3 text-lg font-bold text-slate-700 transition hover:border-red-400 has-[:checked]:border-red-600 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
                      <input
                        type="radio"
                        name="needs_painting"
                        checked={form.needs_painting === true}
                        onChange={() => setForm({ ...form, needs_painting: true })}
                        className="hidden"
                      />
                      SI
                    </label>
                    <label className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-3 text-lg font-bold text-slate-700 transition hover:border-green-400 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:checked]:text-green-700">
                      <input
                        type="radio"
                        name="needs_painting"
                        checked={form.needs_painting === false}
                        onChange={() => setForm({ ...form, needs_painting: false })}
                        className="hidden"
                      />
                      NO
                    </label>
                  </div>
                </div>
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
            <div className="grid grid-cols-1 gap-4">
              {/* FOTO 1 — Da vicino */}
              <input
                ref={inputRavvicinataRef}
                id="input-ravvicinata"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const objectUrl = URL.createObjectURL(file);
                    setFileRavvicinata(file);
                    setPreviewRavvicinata(objectUrl);
                  }
                  setTimeout(() => { if (inputRavvicinataRef.current) inputRavvicinataRef.current.value = ''; }, 100);
                }}
              />
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-base font-black text-slate-800 uppercase tracking-wide">📷 FOTO DA VICINO</p>
                <p className="text-xs text-slate-500 mb-3">Max 1 metro dall&apos;idrante</p>
                {previewRavvicinata ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewRavvicinata} alt="Ravvicinata" className="h-32 w-full object-contain rounded-lg border border-slate-200" />
                    <div className="flex items-center gap-2">
                      <span className="flex-1 rounded-lg bg-emerald-100 py-1.5 text-center text-sm font-bold text-emerald-700">✓ FOTO OK / ACQUISITA</span>
                      <button
                        type="button"
                        onClick={() => inputRavvicinataRef.current?.click()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        Cambia foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRavvicinataRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-6 text-slate-500 hover:bg-slate-50 transition"
                  >
                    <ImageUp size={28} aria-hidden="true" />
                    <span className="text-sm font-semibold">Tocca per scattare</span>
                  </button>
                )}
              </div>

              {/* FOTO 2 — Panoramica */}
              <input
                ref={inputPanoramicaRef}
                id="input-panoramica"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const objectUrl = URL.createObjectURL(file);
                    setFilePanoramica(file);
                    setPreviewPanoramica(objectUrl);
                  }
                  setTimeout(() => { if (inputPanoramicaRef.current) inputPanoramicaRef.current.value = ''; }, 100);
                }}
              />
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-base font-black text-slate-800 uppercase tracking-wide">🌄 FOTO PANORAMICA ORIZZONTALE</p>
                <p className="text-xs text-slate-500 mb-3">Minimo 3 metri di distanza</p>
                {previewPanoramica ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewPanoramica} alt="Panoramica" className="h-32 w-full object-contain rounded-lg border border-slate-200" />
                    <div className="flex items-center gap-2">
                      <span className="flex-1 rounded-lg bg-emerald-100 py-1.5 text-center text-sm font-bold text-emerald-700">✓ FOTO OK / ACQUISITA</span>
                      <button
                        type="button"
                        onClick={() => inputPanoramicaRef.current?.click()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        Cambia foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputPanoramicaRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-6 text-slate-500 hover:bg-slate-50 transition"
                  >
                    <ImageUp size={28} aria-hidden="true" />
                    <span className="text-sm font-semibold">Tocca per scattare</span>
                  </button>
                )}
              </div>
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

      {/* Massive Bottom Button for NUOVO IDRANTE */}
      {isAdmin && !draftPosition && (
        <div className="absolute inset-x-0 bottom-24 z-[500] flex justify-center px-4 pointer-events-none">
          <button
            type="button"
            onClick={handleNuovoIdrante}
            className="pointer-events-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 py-4 px-6 text-lg font-black tracking-wide text-white shadow-[0_10px_40px_rgba(37,99,235,0.4)] transition-transform hover:scale-[1.02] active:scale-95 border-2 border-white/20"
          >
            <MapPinPlus size={24} aria-hidden="true" />
            NUOVO IDRANTE
          </button>
        </div>
      )}

      {/* Modal Idrante Più Vicino - Bottom Sheet / Drawer */}
      {isClosestListOpen && (
        <>
          {/* Sfondo scuro opzionale per enfatizzare il bottom sheet */}
          <div 
            className="absolute inset-0 z-[550] bg-black/20 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsClosestListOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 z-[600] flex max-h-[70vh] flex-col rounded-t-3xl border-t border-slate-200/80 bg-slate-50 shadow-[0_-12px_40px_rgb(0,0,0,0.15)] md:bottom-4 md:left-4 md:w-[400px] md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6 rounded-t-3xl md:rounded-t-2xl">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Siren className="text-blue-600" /> Idranti più vicini
              </h2>
              <button
                onClick={() => setIsClosestListOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
              {closestHydrantsList.map((h, i) => (
                <div key={h.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">{i + 1}.</span>
                      <span className="text-xl font-black text-slate-800">{h.code}</span>
                    </div>
                    {(h.street || h.street_number) && (
                      <p className="text-sm font-semibold text-slate-600 mt-0.5">📍 {h.street} {h.street_number}</p>
                    )}
                    <p className="text-lg font-black text-blue-600 mt-1">
                      {Math.round(h.distance)} <span className="text-sm font-bold">metri</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsClosestListOpen(false);
                        setSelectedHydrant(h);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-base font-bold text-white transition hover:bg-slate-700 active:scale-95 min-h-[48px]"
                    >
                      Dettagli
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-base font-bold text-white transition hover:bg-indigo-700 active:scale-95 min-h-[48px]"
                    >
                      🗺️ Naviga
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Scheda Dettaglio Idrante Full Screen */}
      {selectedHydrant && (
        <div className="absolute inset-0 z-[600] flex flex-col bg-slate-100 md:inset-y-4 md:inset-x-4 md:rounded-3xl md:shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-5 md:px-6 ${
            selectedHydrant.status === "Non funzionante"
              ? "bg-rose-600"
              : selectedHydrant.status === "Funzionante"
              ? "bg-emerald-600"
              : "bg-amber-500"
          }`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-0.5">
                {selectedHydrant.type}
              </p>
              <h2 className="text-2xl font-black text-white leading-tight">
                {selectedHydrant.code ? `IDRANTE ${selectedHydrant.code}` : "IDRANTE"}
              </h2>
              {(selectedHydrant.street || selectedHydrant.street_number) && (
                <p className="text-base font-semibold text-white/90 mt-1">
                  📍 {selectedHydrant.street} {selectedHydrant.street_number}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedHydrant(null)}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">

            {/* Stato + Naviga */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-4 flex flex-col gap-1 ${
                selectedHydrant.status === "Funzionante"
                  ? "bg-emerald-50 border-2 border-emerald-300"
                  : selectedHydrant.status === "Non funzionante"
                  ? "bg-rose-50 border-2 border-rose-300"
                  : "bg-amber-50 border-2 border-amber-300"
              }`}>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">💧 Stato</span>
                <span className={`text-lg font-black leading-tight ${
                  selectedHydrant.status === "Funzionante" ? "text-emerald-700"
                  : selectedHydrant.status === "Non funzionante" ? "text-rose-700"
                  : "text-amber-700"
                }`}>
                  {STATUS_LABELS[selectedHydrant.status]}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHydrant.latitude},${selectedHydrant.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-indigo-600 p-4 text-white transition hover:bg-indigo-700 active:scale-95"
              >
                <span className="text-2xl">🗺️</span>
                <span className="text-sm font-black">NAVIGA</span>
              </a>
            </div>

            {/* Dati tecnici */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🔧 Dati Tecnici</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Tipo</span>
                  <span className="text-lg font-black text-slate-800">{selectedHydrant.type}</span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Attacchi DN</span>
                  <span className="text-lg font-black text-slate-800">{selectedHydrant.dn || "—"}</span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Conservazione</span>
                  <span className="text-lg font-black text-slate-800">{selectedHydrant.condition || "—"}</span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Segnale</span>
                  <span className="text-lg font-black text-slate-800">{selectedHydrant.sign_present ? "✅ Sì" : "❌ No"}</span>
                </div>
              </div>
            </div>

            {/* Accessori */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🕳️ Accessori & Pozzetto</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 border-2 ${(selectedHydrant.caps_quantity ?? 0) > 0 ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Tappi Mancanti</span>
                  <span className={`text-3xl font-black ${(selectedHydrant.caps_quantity ?? 0) > 0 ? "text-rose-600" : "text-slate-800"}`}>{selectedHydrant.caps_quantity ?? 0}</span>
                </div>
                <div className={`rounded-xl p-3 border-2 ${(selectedHydrant.chains_quantity ?? 0) > 0 ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Catene Mancanti</span>
                  <span className={`text-3xl font-black ${(selectedHydrant.chains_quantity ?? 0) > 0 ? "text-rose-600" : "text-slate-800"}`}>{selectedHydrant.chains_quantity ?? 0}</span>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 border-2 border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-500 block mb-1">🧢 Cappello Colonna</span>
                  <span className={`text-xl font-black ${
                    selectedHydrant.cappellotto_status === "mancante" || selectedHydrant.cappellotto_status === "danneggiato" 
                    ? "text-rose-600" : "text-slate-800"
                  }`}>
                    {selectedHydrant.cappellotto_status === "integro" ? "✅ Presente e integro" : 
                     selectedHydrant.cappellotto_status === "mancante" ? "❌ Mancante" : 
                     selectedHydrant.cappellotto_status === "danneggiato" ? "⚠️ Danneggiato" : "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-3">
                  <span className="text-xs font-bold uppercase text-slate-500 block mb-1">🕳️ Pozzetto Valvola</span>
                  <span className="text-xl font-black text-slate-800">{selectedHydrant.has_pit ? "✅ Presente" : "❌ Assente"}</span>
                </div>
                {selectedHydrant.has_pit && (
                  <div className={`rounded-xl p-3 border-2 ${
                    selectedHydrant.pit_status === "bloccato" ? "bg-rose-50 border-rose-300" : "bg-slate-50 border-slate-200"
                  }`}>
                    <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Stato Pozzetto</span>
                    <span className={`text-xl font-black ${
                      selectedHydrant.pit_status === "bloccato" ? "text-rose-600" : "text-slate-800"
                    }`}>
                      {selectedHydrant.pit_status === "apre_facilmente" ? "✅ Si apre" : 
                       selectedHydrant.pit_status === "bloccato" ? "❌ Bloccato" : 
                       selectedHydrant.pit_status === "non_ispezionabile" ? "⚠️ Non ispezionabile" : "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">📝 Note</h3>
              <p className="text-base font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedHydrant.notes || "Nessuna nota presente."}
              </p>
            </div>

            {/* Foto Section */}
            {(selectedHydrant.photo_url || selectedHydrant.pit_photo_url) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">📷 Documentazione Fotografica</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedHydrant.photo_url && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase text-slate-500 block">Ravvicinata / Dettaglio</span>
                      <a href={selectedHydrant.photo_url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedHydrant.photo_url} alt="Ravvicinata" className="w-full h-48 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition" />
                      </a>
                    </div>
                  )}
                  {selectedHydrant.pit_photo_url && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase text-slate-500 block">Interno Pozzetto</span>
                      <a href={selectedHydrant.pit_photo_url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedHydrant.pit_photo_url} alt="Pozzetto" className="w-full h-48 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Modifica */}
          {isAdmin && (
            <div className="border-t border-slate-200 bg-white p-4 md:p-6">
              <button
                onClick={() => {
                  setSelectedHydrant(null);
                  setDraftPosition({
                    latitude: selectedHydrant.latitude,
                    longitude: selectedHydrant.longitude,
                  });
                  setIsDrawerOpen(true);
                  setForm({
                    code: selectedHydrant.code,
                    street: selectedHydrant.street || "",
                    street_number: selectedHydrant.street_number || "",
                    type: selectedHydrant.type,
                    connections: selectedHydrant.connections || [],
                    status: selectedHydrant.status,
                    condition: (selectedHydrant.condition as HydrantCondition) || "DISCRETO",
                    uni45Count: 0,
                    uni70Count: 0,
                    missingCaps: selectedHydrant.caps_quantity ?? 0,
                    missingChains: selectedHydrant.chains_quantity ?? 0,
                    sign_present: selectedHydrant.sign_present !== undefined ? selectedHydrant.sign_present : null,
                    accessibility: selectedHydrant.accessibility || "",
                    notes: selectedHydrant.notes || "",
                    has_pit: selectedHydrant.has_pit ?? null,
                    pit_status: selectedHydrant.pit_status ?? null,
                    needs_painting: selectedHydrant.needs_painting ?? null,
                    cappellotto_status: selectedHydrant.cappellotto_status ?? null,
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 active:scale-[0.98]"
              >
                <Pencil size={18} /> Modifica Scheda Tecnica
              </button>
            </div>
          )}
        </div>
      )}
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
