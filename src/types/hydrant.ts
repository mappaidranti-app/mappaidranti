export type HydrantStatus = "operativo" | "da_verificare" | "fuori_servizio";

export type HydrantType =
  | "soprassuolo"
  | "sottosuolo"
  | "colonnina"
  | "naspo"
  | "altro";

export type Hydrant = {
  id: string;
  municipality_id: string;
  code: string;
  type: HydrantType;
  status: HydrantStatus;
  notes: string | null;
  latitude: number;
  longitude: number;
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
