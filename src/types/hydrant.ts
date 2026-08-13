export type HydrantStatus = "Funzionante" | "Non funzionante" | "Da verificare";

export type HydrantCondition = "Nuovo" | "Buono" | "Pessimo";

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
};

export type HydrantFormState = {
  code: string;
  hamlet: string;
  street: string;
  street_number: string;
  type: HydrantType;
  connections: string[];
  status: HydrantStatus;
  condition: HydrantCondition;
  dn: string;
  caps_present: boolean | null;
  caps_quantity: number;
  chains_present: boolean | null;
  chains_quantity: number;
  attached_pit: boolean | null;
  sign_present: boolean | null;
  accessibility: string;
  notes: string;
};

