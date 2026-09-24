"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";

// Client con Service Role Key: bypassa RLS. Usarlo SOLO dopo aver verificato il chiamante.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Dominio fittizio per le utenze Auth tecniche degli operatori (nessuna email viene mai inviata). */
const OPERATOR_EMAIL_DOMAIN = "operatori.idrantya.invalid";
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
/** ~100 anni: equivale a "disabilitato" finché non viene riattivato. */
const BAN_FOREVER = "876000h";
/** Hash fittizio: rende uguale il tempo di risposta anche se il telefono non esiste. */
const DUMMY_PIN_HASH = bcrypt.hashSync("dummy-pin", 10);

// ---------------------------------------------------------------------------
// Verifica del chiamante
// ---------------------------------------------------------------------------

type Caller = {
  userId: string;
  role: string | null;
  municipalityId: string | null;
  /** superadmin, oppure referent senza comune (convenzione storica del progetto) */
  isSuperAdmin: boolean;
  /** può gestire comune/operatori (superadmin, referent, admin_ente) */
  isAdmin: boolean;
};

const ADMIN_ROLES = ["referent", "superadmin", "admin_ente"];

/**
 * Ricava l'utente dal token di sessione Supabase (JWT) inviato dal client.
 * Non si fida MAI di un userId passato dal browser.
 */
async function getCaller(accessToken: string | null | undefined): Promise<Caller | null> {
  if (!accessToken) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, municipality_id")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  const municipalityId = profile?.municipality_id ?? null;
  const isSuperAdmin = role === "superadmin" || (role === "referent" && !municipalityId);

  return {
    userId: data.user.id,
    role,
    municipalityId,
    isSuperAdmin,
    isAdmin: !!role && ADMIN_ROLES.includes(role),
  };
}

/** Il chiamante può gestire il comune indicato? */
function canManageMunicipality(caller: Caller, municipalityId: string | null | undefined) {
  if (!caller.isAdmin || !municipalityId) return false;
  return caller.isSuperAdmin || caller.municipalityId === municipalityId;
}

const NOT_AUTHENTICATED = "Sessione non valida: effettua di nuovo il login.";
const NOT_AUTHORIZED = "Operazione non autorizzata.";

// ---------------------------------------------------------------------------
// Ruolo / dashboard
// ---------------------------------------------------------------------------

/** Ruolo dell'utente autenticato (ricavato dal token, non da un ID passato dal client). */
export async function getUserRole(accessToken: string) {
  try {
    const caller = await getCaller(accessToken);
    return { role: caller?.role ?? null };
  } catch (err) {
    console.error("Eccezione getUserRole:", err);
    return { role: null };
  }
}

/**
 * Dati per la dashboard. Il superadmin vede tutti i comuni, gli altri admin solo il proprio.
 */
export async function getDashboardData(accessToken: string) {
  try {
    const caller = await getCaller(accessToken);
    if (!caller) return { error: NOT_AUTHENTICATED };
    if (!caller.isAdmin) return { error: "Non autorizzato o profilo mancante" };

    const { isSuperAdmin, municipalityId } = caller;

    const { data: rawMunicipalities } = isSuperAdmin
      ? await supabaseAdmin.from("municipalities").select("*").order("name")
      : await supabaseAdmin.from("municipalities").select("*").eq("id", municipalityId).limit(1);

    const municipalities = rawMunicipalities || [];

    if (municipalities.length > 0) {
      const municipalityIds = municipalities.map((m) => m.id);
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id, email, municipality_id")
        .eq("role", "admin_ente")
        .in("municipality_id", municipalityIds);

      if (admins) {
        municipalities.forEach((m: any) => {
          const admin = admins.find((a) => a.municipality_id === m.id);
          if (admin) {
            m.admin_email = admin.email;
            m.admin_id = admin.id;
          }
        });
      }
    }

    const municipality = isSuperAdmin ? null : (municipalities?.[0] || null);

    return { isSuperAdmin, municipalities, municipality, referentId: caller.userId };
  } catch (err: any) {
    console.error("Eccezione in getDashboardData:", err);
    return { error: "Errore imprevisto nel caricamento della dashboard" };
  }
}

// ---------------------------------------------------------------------------
// Comuni (solo superadmin)
// ---------------------------------------------------------------------------

/**
 * Crea atomicamente un Comune e il suo Admin Ente (solo superadmin).
 */
export async function createMunicipalityAndAdmin(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY non trovata nelle env server." };
  }

  const caller = await getCaller(formData.get("accessToken") as string);
  if (!caller) return { success: false, error: NOT_AUTHENTICATED };
  if (!caller.isSuperAdmin) return { success: false, error: NOT_AUTHORIZED };

  const municipalityName = (formData.get("municipalityName") as string)?.trim();
  const adminFullName = (formData.get("adminFullName") as string)?.trim();
  const adminEmail = (formData.get("adminEmail") as string)?.trim();
  const adminPassword = (formData.get("adminPassword") as string)?.trim();

  if (!municipalityName) return { success: false, error: "Il nome del Comune è obbligatorio." };
  if (!adminFullName) return { success: false, error: "Il nome del Responsabile Admin è obbligatorio." };
  if (!adminEmail) return { success: false, error: "L'email istituzionale è obbligatoria." };
  if (!adminPassword || adminPassword.length < 6) return { success: false, error: "La password deve essere di almeno 6 caratteri." };

  let newUserId: string | null = null;
  let newMunicipalityId: string | null = null;

  try {
    const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (userErr || !newUser?.user?.id) {
      console.error("createMunicipalityAndAdmin – errore creazione Auth:", userErr);
      return { success: false, error: `Errore creazione utente Auth: ${userErr?.message ?? "risposta vuota"}` };
    }
    newUserId = newUser.user.id;

    const { data: newMunicipality, error: munErr } = await supabaseAdmin
      .from("municipalities")
      .insert({ name: municipalityName, contact_name: adminFullName })
      .select()
      .single();

    if (munErr || !newMunicipality?.id) {
      console.error("createMunicipalityAndAdmin – errore creazione Comune:", munErr);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Errore creazione Comune nel DB: ${munErr?.message ?? "risposta vuota"}` };
    }
    newMunicipalityId = newMunicipality.id;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        full_name: adminFullName,
        email: adminEmail,
        role: "admin_ente",
        municipality_id: newMunicipalityId,
      });

    if (profileErr) {
      console.error("createMunicipalityAndAdmin – errore upsert profilo:", profileErr);
      await supabaseAdmin.from("municipalities").delete().eq("id", newMunicipalityId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Errore salvataggio profilo Admin Ente: ${profileErr.message}` };
    }

    revalidatePath("/admin/superadmin");
    return { success: true, municipality: newMunicipality };
  } catch (err: any) {
    console.error("createMunicipalityAndAdmin – eccezione:", err);
    if (newMunicipalityId) await Promise.resolve(supabaseAdmin.from("municipalities").delete().eq("id", newMunicipalityId)).catch(() => {});
    if (newUserId) await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
    return { success: false, error: `Errore imprevisto: ${String(err)}` };
  }
}

/**
 * Aggiorna un Comune e il suo Admin Ente associato (solo superadmin).
 */
export async function updateMunicipalityAndAdmin(formData: FormData) {
  try {
    const caller = await getCaller(formData.get("accessToken") as string);
    if (!caller) return { success: false, error: NOT_AUTHENTICATED };
    if (!caller.isSuperAdmin) return { success: false, error: NOT_AUTHORIZED };

    const municipalityId = formData.get("municipalityId") as string;
    const municipalityName = formData.get("municipalityName") as string;
    const adminFullName = formData.get("adminFullName") as string;
    const adminEmail = formData.get("adminEmail") as string;
    const adminPassword = formData.get("adminPassword") as string; // Opzionale

    if (!municipalityId || !municipalityName || !adminFullName || !adminEmail) {
      return { success: false, error: "Dati mancanti" };
    }

    const { error: munErr } = await supabaseAdmin
      .from("municipalities")
      .update({ name: municipalityName, contact_name: adminFullName })
      .eq("id", municipalityId);

    if (munErr) {
      return { success: false, error: `Errore aggiornamento Comune: ${munErr.message}` };
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("municipality_id", municipalityId)
      .eq("role", "admin_ente")
      .maybeSingle();

    if (adminProfile?.id) {
      const adminId = adminProfile.id;

      const updateData: { email: string; password?: string } = { email: adminEmail };
      if (adminPassword && adminPassword.trim().length >= 6) {
        updateData.password = adminPassword;
      }
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(adminId, updateData);
      if (authErr) {
        return { success: false, error: `Errore aggiornamento Auth: ${authErr.message}` };
      }

      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: adminFullName, email: adminEmail })
        .eq("id", adminId);
      if (profErr) {
        return { success: false, error: `Errore aggiornamento Profilo: ${profErr.message}` };
      }
    }

    revalidatePath("/admin/superadmin");
    return { success: true };
  } catch (err: any) {
    console.error("updateMunicipalityAndAdmin – eccezione:", err);
    return { success: false, error: `Errore imprevisto: ${String(err)}` };
  }
}

/**
 * Elimina un Comune e il suo Admin Ente associato (solo superadmin).
 */
export async function deleteMunicipalityAndAdmin(formData: FormData) {
  try {
    const caller = await getCaller(formData.get("accessToken") as string);
    if (!caller) return { success: false, error: NOT_AUTHENTICATED };
    if (!caller.isSuperAdmin) return { success: false, error: NOT_AUTHORIZED };

    const municipalityId = formData.get("municipalityId") as string;
    if (!municipalityId) return { success: false, error: "ID Comune mancante" };

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("municipality_id", municipalityId)
      .eq("role", "admin_ente")
      .maybeSingle();

    // Utenze Auth tecniche degli operatori del comune (vanno rimosse esplicitamente)
    const { data: ops } = await supabaseAdmin
      .from("operators")
      .select("auth_user_id")
      .eq("municipality_id", municipalityId);

    const { error: munErr } = await supabaseAdmin
      .from("municipalities")
      .delete()
      .eq("id", municipalityId);

    if (munErr) {
      return { success: false, error: `Errore eliminazione Comune: ${munErr.message}` };
    }

    if (adminProfile?.id) {
      await supabaseAdmin.auth.admin.deleteUser(adminProfile.id);
    }
    for (const op of ops ?? []) {
      if (op.auth_user_id) await supabaseAdmin.auth.admin.deleteUser(op.auth_user_id).catch(() => {});
    }

    revalidatePath("/admin/superadmin");
    return { success: true };
  } catch (err: any) {
    console.error("deleteMunicipalityAndAdmin – eccezione:", err);
    return { success: false, error: `Errore imprevisto: ${String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// Operatori di campo
// ---------------------------------------------------------------------------

const OPERATOR_PUBLIC_COLUMNS = "id, municipality_id, name, phone, is_active, created_at, updated_at";

/**
 * Crea un nuovo operatore di campo. Un admin di comune può crearlo solo per il proprio comune.
 */
export async function createOperator(formData: FormData) {
  const caller = await getCaller(formData.get("accessToken") as string);
  if (!caller) return { error: NOT_AUTHENTICATED };
  if (!caller.isAdmin) return { error: NOT_AUTHORIZED };

  const requestedMunicipalityId = formData.get("municipality_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const pin = (formData.get("pin") as string)?.trim();

  const targetMunicipalityId = caller.isSuperAdmin ? requestedMunicipalityId : caller.municipalityId;
  if (!targetMunicipalityId) return { error: "Comune non valido o mancante" };
  if (!name || !phone) return { error: "Nome e telefono sono obbligatori" };
  if (!/^\d{4,6}$/.test(pin || "")) return { error: "Il PIN deve essere di 4-6 cifre." };

  const { data: existing } = await supabaseAdmin
    .from("operators")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return { error: "Esiste già un operatore con questo numero di telefono" };

  const pinHash = await bcrypt.hash(pin, 10);

  const { data: newOp, error } = await supabaseAdmin
    .from("operators")
    .insert({
      municipality_id: targetMunicipalityId,
      name,
      phone,
      pin_hash: pinHash,
      is_active: true,
    })
    .select(OPERATOR_PUBLIC_COLUMNS)
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/superadmin");
  return { success: true, operator: newOp };
}

/**
 * Lista operatori di un comune (senza pin_hash).
 */
export async function getOperatorsByMunicipality(accessToken: string, municipalityId: string) {
  const caller = await getCaller(accessToken);
  if (!caller) return { error: NOT_AUTHENTICATED };
  if (!canManageMunicipality(caller, municipalityId)) return { error: NOT_AUTHORIZED };

  const { data, error } = await supabaseAdmin
    .from("operators")
    .select(OPERATOR_PUBLIC_COLUMNS)
    .eq("municipality_id", municipalityId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { operators: data };
}

/** Carica un operatore e verifica che il chiamante possa gestirlo. */
async function loadManagedOperator(caller: Caller, operatorId: string) {
  const { data: op } = await supabaseAdmin
    .from("operators")
    .select("id, municipality_id, auth_user_id")
    .eq("id", operatorId)
    .maybeSingle();
  if (!op) return { error: "Operatore non trovato" as const };
  if (!canManageMunicipality(caller, op.municipality_id)) return { error: NOT_AUTHORIZED };
  return { op };
}

/**
 * Abilita / disabilita un operatore. Se disabilitato, la sua sessione non può più essere rinnovata.
 */
export async function toggleOperatorStatus(accessToken: string, operatorId: string, isActive: boolean) {
  const caller = await getCaller(accessToken);
  if (!caller) return { error: NOT_AUTHENTICATED };
  if (!operatorId) return { error: "ID operatore mancante" };

  const res = await loadManagedOperator(caller, operatorId);
  if ("error" in res) return { error: res.error };

  const { error } = await supabaseAdmin
    .from("operators")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", operatorId);
  if (error) return { error: error.message };

  if (res.op.auth_user_id) {
    await supabaseAdmin.auth.admin.updateUserById(res.op.auth_user_id, {
      ban_duration: isActive ? "none" : BAN_FOREVER,
    });
  }

  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Elimina un operatore e la sua utenza Auth tecnica.
 */
export async function deleteOperator(accessToken: string, operatorId: string) {
  const caller = await getCaller(accessToken);
  if (!caller) return { error: NOT_AUTHENTICATED };

  const res = await loadManagedOperator(caller, operatorId);
  if ("error" in res) return { error: res.error };

  const { error: delOp } = await supabaseAdmin.from("operators").delete().eq("id", operatorId);
  if (delOp) return { error: delOp.message };

  if (res.op.auth_user_id) {
    await supabaseAdmin.from("profiles").delete().eq("id", res.op.auth_user_id);
    await supabaseAdmin.auth.admin.deleteUser(res.op.auth_user_id).catch(() => {});
  }

  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Garantisce che l'operatore abbia un'utenza Supabase Auth tecnica e un profilo "operator"
 * legato al suo comune. Restituisce l'email dell'utenza.
 */
async function ensureOperatorAuthUser(operator: {
  id: string;
  name: string;
  municipality_id: string;
  auth_user_id: string | null;
}): Promise<{ email: string; userId: string } | { error: string }> {
  const email = `operatore-${operator.id}@${OPERATOR_EMAIL_DOMAIN}`;
  let userId = operator.auth_user_id;

  if (userId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) userId = null; // utenza rimossa: la ricreiamo
  }

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { operator_id: operator.id, name: operator.name },
      app_metadata: { role: "operator", operator_id: operator.id },
    });
    if (error || !data?.user) {
      console.error("ensureOperatorAuthUser – createUser:", error);
      return { error: "Impossibile creare la sessione operatore" };
    }
    userId = data.user.id;
    await supabaseAdmin.from("operators").update({ auth_user_id: userId }).eq("id", operator.id);
  } else {
    // Se l'operatore era stato disabilitato e poi riattivato, assicuriamoci che non sia bannato
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }

  // Profilo sempre allineato al comune dell'operatore (usato dalle policy RLS)
  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    role: "operator",
    municipality_id: operator.municipality_id,
    full_name: operator.name,
    email,
  });
  if (profileErr) {
    console.error("ensureOperatorAuthUser – profilo:", profileErr);
    return { error: "Impossibile preparare il profilo operatore" };
  }

  return { email, userId };
}

/**
 * Login operatore di campo (telefono + PIN).
 * Se le credenziali sono valide restituisce un token monouso che il client scambia con
 * una vera sessione Supabase (supabase.auth.verifyOtp), così le policy RLS si applicano.
 */
export async function loginOperator(phone: string, pin: string) {
  phone = phone?.trim();
  pin = pin?.trim();
  if (!phone || !pin) return { error: "Dati mancanti" };

  const { data: operator } = await supabaseAdmin
    .from("operators")
    .select("id, name, municipality_id, pin_hash, is_active, auth_user_id, failed_pin_attempts, locked_until")
    .eq("phone", phone)
    .maybeSingle();

  if (!operator) {
    // Tempo di risposta simile al caso "PIN errato" per non rivelare quali numeri esistono
    await bcrypt.compare(pin, DUMMY_PIN_HASH);
    return { error: "Credenziali non valide" };
  }
  if (!operator.is_active) return { error: "Utenza disabilitata" };

  if (operator.locked_until && new Date(operator.locked_until) > new Date()) {
    return { error: `Troppi tentativi errati. Riprova tra qualche minuto.` };
  }

  const isValid = await bcrypt.compare(pin, operator.pin_hash);
  if (!isValid) {
    const attempts = (operator.failed_pin_attempts ?? 0) + 1;
    const lock = attempts >= MAX_PIN_ATTEMPTS;
    await supabaseAdmin
      .from("operators")
      .update({
        failed_pin_attempts: lock ? 0 : attempts,
        locked_until: lock ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq("id", operator.id);
    return { error: lock ? `Troppi tentativi errati: accesso bloccato per ${PIN_LOCK_MINUTES} minuti.` : "Credenziali non valide" };
  }

  if (operator.failed_pin_attempts || operator.locked_until) {
    await supabaseAdmin
      .from("operators")
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq("id", operator.id);
  }

  const authUser = await ensureOperatorAuthUser(operator);
  if ("error" in authUser) return { error: authUser.error };

  // Nessuna email viene inviata: generateLink restituisce solo il token.
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("loginOperator – generateLink:", linkErr);
    return { error: "Impossibile avviare la sessione operatore" };
  }

  return {
    success: true,
    tokenHash,
    operator: { id: operator.id, municipality_id: operator.municipality_id, name: operator.name },
  };
}
