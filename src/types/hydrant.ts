export type HydrantStatus = "Funzionante" | "Non funzionante" | "Da verificare";

export type HydrantCondition = "NUOVO" | "DISCRETO" | "SUFFICIENTE" | "PESSIMO / DANNEGGIATO";

export type HydrantType = "Soprasuolo" | "Sottosuolo" | "Parete";

export type Hydrant = {
  id: string;
  code: string;
  type: HydrantType;
  status: HydrantStatus;
  condition?: HydrantCondition | null;
  dn?: string | null;
  caps_present?: boolean | null;
  caps_quantity?: number | null;
  chains_present?: boolean | null;
  chains_quantity?: number | null;
  attached_pit?: boolean | null;
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
  needs_painting?: boolean | null;
  in_pit?: boolean | null;
  pit_inspectable?: boolean | null;
  photo_pit_url?: string | null;
  hat_missing?: boolean | null;
};

export type HydrantFormState = {
  code: string;
  street: string;
  street_number: string;
  type: HydrantType;
  connections: string[];
  status: HydrantStatus;
  condition: HydrantCondition;
  uni45Count: number;
  uni70Count: number;
  missingCaps: number;
  missingChains: number;
  hasCover: boolean;
  sign_present: boolean | null;
  accessibility: string;
  notes: string;
  needsPainting: boolean;
  inPit: boolean | null;
  pitInspectable: boolean | null;
  hatMissing: boolean;
};

