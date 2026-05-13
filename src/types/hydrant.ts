export type HydrantStatus = "operativo" | "da_verificare" | "fuori_servizio";

export type HydrantType =
  | "soprassuolo"
  | "sottosuolo"
  | "colonnina"
  | "naspo"
  | "altro";

export type Hydrant = {
  id: string;
  code: string;
  type: HydrantType;
  status: HydrantStatus;
  notes: string | null;
  lat: number;
  lng: number;
  photo_url: string | null;
  created_at?: string;
};

export type HydrantFormState = {
  code: string;
  type: HydrantType;
  status: HydrantStatus;
  notes: string;
  photo: File | null;
};
