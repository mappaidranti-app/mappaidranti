export type HydrantStatus = "Funzionante" | "Non funzionante" | "Da verificare";

export type HydrantType = "Soprasuolo" | "Sottosuolo" | "Parete";

export type Hydrant = {
  id: string;
  code: string;
  type: HydrantType;
  status: HydrantStatus;
  notes: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  created_at?: string;
  municipality_id?: string | null;
  hamlet?: string | null;
  street?: string | null;
  street_number?: string | null;
  connections?: string[];
  sign_present?: boolean | null;
  accessibility?: string | null;
};

export type HydrantFormState = {
  code: string;
  hamlet: string;
  street: string;
  street_number: string;
  type: HydrantType;
  connections: string[];
  status: HydrantStatus;
  sign_present: boolean | null;
  accessibility: string;
  notes: string;
  photo: File | null;
};
