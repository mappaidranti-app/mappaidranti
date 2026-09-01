export type HydrantStatus = "Funzionante" | "Non funzionante" | "Da verificare";

export type HydrantCondition = "NUOVO" | "DISCRETO" | "SUFFICIENTE" | "PESSIMO / DANNEGGIATO";

export type HydrantType = "A COLONNA" | "SOTTOSUOLO";

/** Stato del pozzetto valvola d'arresto (a terra, affiancato alla colonna) */
export type PitStatus = "apre_facilmente" | "bloccato" | "non_ispezionabile";

/** Stato del cappellotto della colonna idrante */
export type CappellottoStatus = "integro" | "mancante" | "danneggiato";

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
  /** @deprecated Usare cappellotto_status */
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
  /** Presenza del pozzetto valvola d'arresto */
  has_pit?: boolean | null;
  /** @deprecated Usare pit_status */
  pit_inspectable?: boolean | null;
  pit_photo_url?: string | null;
  needs_painting?: boolean | null;
  /** Stato di apertura del pozzetto valvola d'arresto */
  pit_status?: PitStatus | null;
  /** Stato del cappellotto della colonna idrante */
  cappellotto_status?: CappellottoStatus | null;
};

export type HydrantFormState = {
  code: string;
  street: string;
  street_number: string;
  type: HydrantType;
  connections: string[];
  status: HydrantStatus | null;
  condition: HydrantCondition | null;
  uni45Count: number;
  uni70Count: number;
  caps_status: "OK" | "KO" | null;
  missingCaps: number | null;
  chains_status: "OK" | "KO" | null;
  missingChains: number | null;
  sign_present: boolean | null;
  accessibility: string;
  notes: string;
  /** Presenza del pozzetto valvola d'arresto */
  has_pit: boolean | null;
  /** Stato di apertura del pozzetto */
  pit_status: PitStatus | null;
  needs_painting: boolean | null;
  /** Stato del cappellotto colonna */
  cappellotto_status: CappellottoStatus | null;
};
