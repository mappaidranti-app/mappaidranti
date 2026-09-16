"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";

// Client standard (no auth) per operazioni di amministrazione
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Ottiene il ruolo dell'utente bypassando RLS, usando l'ID utente passato dal client.
 */
export async function getUserRole(userId: string) {
  if (!userId) return { role: null };

  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Errore getUserRole:", error.message);
      return { role: null };
    }

    return { role: profile?.role || null };
  } catch (err) {
    console.error("Eccezione getUserRole:", err);
    return { role: null };
  }
}

/**
 * Funzione di bypass per sviluppatori: aggiorna il ruolo dell'utente corrente a superadmin
 */
export async function upgradeToSuperAdmin(userId: string) {
  if (!userId) return { error: "Non autenticato" };

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role: "superadmin", municipality_id: null })
    .eq("id", userId);

  if (error) return { error: error.message };
  
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Ottiene i dati per la dashboard bypassando RLS.
 * Se l'utente non ha municipality_id è un super-admin: vede tutti i comuni.
 */
export async function getDashboardData(userId: string) {
  if (!userId) return { error: "Non autenticato" };

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, municipality_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("Errore recupero profilo (gestito):", profileErr.message);
      return { error: "Errore durante la lettura del profilo" };
    }

    // Ruoli ammessi al pannello admin
    const ADMIN_ROLES = ["referent", "superadmin", "admin_ente"];
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return { error: "Non autorizzato o profilo mancante" };
    }

    // superadmin e referent senza municipality_id vedono tutto
    const isSuperAdmin = profile.role === "superadmin" || profile.role === "referent" && !profile.municipality_id;
    const municipalityId = profile.municipality_id;

    // Super admin vede tutti i comuni; referente/admin_ente vede solo il suo
    const { data: rawMunicipalities } = isSuperAdmin
      ? await supabaseAdmin.from("municipalities").select("*").order("name")
      : await supabaseAdmin.from("municipalities").select("*").eq("id", municipalityId).limit(1);

    const municipalities = rawMunicipalities || [];

    // Recupera anche i profili admin_ente per associarli ai comuni
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

    let operators: { id: string, full_name: string, email: string, created_at: string, municipality_id?: string }[] = [];
    if (isSuperAdmin) {
      const { data: ops } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, created_at, municipality_id")
        .eq("role", "operator")
        .order("created_at", { ascending: false });
      if (ops) operators = ops;
    } else if (municipality) {
      const { data: ops } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, created_at, municipality_id")
        .eq("role", "operator")
        .eq("municipality_id", municipality.id)
        .order("created_at", { ascending: false });
      if (ops) operators = ops;
    }

    return { isSuperAdmin, municipalities: municipalities || [], municipality, operators, referentId: userId };
  } catch (err: any) {
    console.error("Eccezione in getDashboardData:", err);
    return { error: "Errore imprevisto nel caricamento della dashboard" };
  }
}

/**
 * Crea un nuovo Comune e il suo Referente (solo super admin).
 */
const withTimeout = <T>(promise: Promise<T>, ms: number = 8000, errorMsg: string = "Timeout request"): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

export async function createMunicipality(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY non trovata nelle env server." };
  }

  try {
    const municipalityName = formData.get("municipalityName") as string;
    const province = (formData.get("province") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    
    const ref1Name = (formData.get("ref1Name") as string) || null;
    const ref1Role = (formData.get("ref1Role") as string) || null;
    const ref1Phone = (formData.get("ref1Phone") as string) || null;
    const ref1Email = (formData.get("ref1Email") as string) || null;
    
    const ref2Name = (formData.get("ref2Name") as string) || null;
    const ref2Role = (formData.get("ref2Role") as string) || null;
    const ref2Phone = (formData.get("ref2Phone") as string) || null;
    const ref2Email = (formData.get("ref2Email") as string) || null;

    const adminName = formData.get("adminName") as string;
    const adminEmail = formData.get("adminEmail") as string;
    const adminPassword = formData.get("adminPassword") as string;
    
    const callerUserId = formData.get("callerUserId") as string;

    if (!callerUserId) return { success: false, error: "Utente non autenticato" };

    // Verifica che sia super admin
    const { data: callerProfile, error: callerErr } = await withTimeout(
      supabaseAdmin
        .from("profiles")
        .select("role, municipality_id")
        .eq("id", callerUserId)
        .single(),
      5000,
      "Timeout recupero profilo chiamante"
    );

    if (callerErr) {
      console.error("Dettaglio errore recupero profilo:", JSON.stringify(callerErr, null, 2));
      
      // Fallback di sicurezza: verifichiamo almeno se esiste in Auth. Se no, fermiamo tutto.
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(callerUserId);
      if (authErr || !authUser?.user) {
        return { success: false, error: "Impossibile verificare i permessi dell'utente corrente." };
      }
      
      return { success: false, error: "Impossibile verificare i permessi dell'utente corrente." };
    }

    if (callerProfile?.role !== "referent" || callerProfile?.municipality_id) {
      return { success: false, error: "Non autorizzato: solo il super admin può creare comuni" };
    }

    // Crea il record del comune
    const { data: newMunicipality, error: munErr } = await withTimeout(
      supabaseAdmin
        .from("municipalities")
        .insert({
          name: municipalityName,
          contact_name: adminName,
          province,
          notes,
          ref1_name: ref1Name,
          ref1_role: ref1Role,
          ref1_phone: ref1Phone,
          ref1_email: ref1Email,
          ref2_name: ref2Name,
          ref2_role: ref2Role,
          ref2_phone: ref2Phone,
          ref2_email: ref2Email
        })
        .select()
        .single(),
      5000,
      "Timeout creazione municipality in DB"
    );

    if (munErr) {
      console.error("Errore creazione municipality in DB:", munErr);
      return { success: false, error: munErr.message };
    }

    // Crea l'utente Supabase per il referente
    const { data: newUser, error: userErr } = await withTimeout(
      supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        phone_confirm: false,
      }),
      8000,
      "Timeout creazione utente Auth"
    );

    if (userErr) {
      console.error("Errore creazione utente Auth:", userErr);
      // Rollback: elimina il comune appena creato
      await withTimeout(
        supabaseAdmin.from("municipalities").delete().eq("id", newMunicipality.id),
        5000,
        "Timeout rollback municipality"
      );
      return { success: false, error: userErr.message };
    }

    // Crea il profilo del referente (Admin Ente)
    const { error: profileErr } = await withTimeout(
      supabaseAdmin.from("profiles").insert({
        id: newUser.user.id,
        role: "referent",
        municipality_id: newMunicipality.id,
        full_name: adminName,
        email: adminEmail,
      }),
      5000,
      "Timeout creazione profilo"
    );

    if (profileErr) {
      console.error("Errore creazione profile:", profileErr);
      // Rollback opzionale (utente auth rimane, ma profile no, potrebbe creare disallineamenti)
      return { success: false, error: profileErr.message };
    }

    // RIMOSSO TEMPORANEAMENTE PER ISOLARE FLUSSO DATI E PREVENIRE HANG
    // revalidatePath("/admin/superadmin");
    
    return { success: true, municipality: newMunicipality };
  } catch (err: any) {
    console.error("Errore catchato in createMunicipality:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Crea un nuovo Comune in modo atomico (solo dati Comune, niente Auth).
 * Usa supabaseAdmin con Service Role Key per bypassare RLS.
 */
export async function createMunicipalitySimple(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY non trovata nelle env server." };
  }

  const name = (formData.get("name") as string)?.trim();
  const province = (formData.get("province") as string)?.trim() || null;
  const istatCode = (formData.get("istatCode") as string)?.trim() || null;

  if (!name) {
    return { success: false, error: "Il nome del Comune è obbligatorio." };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("municipalities")
      .insert({ name, province })
      .select()
      .single();

    if (error) {
      console.error("createMunicipalitySimple – errore DB:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/superadmin");
    return { success: true, data };
  } catch (err: any) {
    console.error("createMunicipalitySimple – eccezione:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Crea atomicamente un Comune e il suo Admin Ente in un unico passaggio.
 * Passaggi: 1) crea utente Auth, 2) crea Comune, 3) inserisce/aggiorna profilo.
 * In caso di errore in qualsiasi fase, restituisce un messaggio esplicito.
 */
export async function createMunicipalityAndAdmin(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY non trovata nelle env server." };
  }

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
    // Passaggio 1: crea l'utente Auth
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

    // Passaggio 2: crea il Comune
    const { data: newMunicipality, error: munErr } = await supabaseAdmin
      .from("municipalities")
      .insert({ name: municipalityName, contact_name: adminFullName })
      .select()
      .single();

    if (munErr || !newMunicipality?.id) {
      console.error("createMunicipalityAndAdmin – errore creazione Comune:", munErr);
      // Rollback utente Auth
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Errore creazione Comune nel DB: ${munErr?.message ?? "risposta vuota"}` };
    }
    newMunicipalityId = newMunicipality.id;

    // Passaggio 3: inserisce/aggiorna il profilo assegnando il ruolo admin_ente
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
      // Rollback: elimina Comune e utente Auth
      await supabaseAdmin.from("municipalities").delete().eq("id", newMunicipalityId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Errore salvataggio profilo Admin Ente: ${profileErr.message}` };
    }

    revalidatePath("/admin/superadmin");
    return { success: true, municipality: newMunicipality };
  } catch (err: any) {
    console.error("createMunicipalityAndAdmin – eccezione:", err);
    // Tentativo di rollback best-effort
    if (newMunicipalityId) await Promise.resolve(supabaseAdmin.from("municipalities").delete().eq("id", newMunicipalityId)).catch(() => {});
    if (newUserId) await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
    return { success: false, error: `Errore imprevisto: ${String(err)}` };
  }
}

/**
 * Aggiorna i 4 campi base di un Comune e del suo Admin Ente associato.
 */
export async function updateMunicipalityAndAdmin(formData: FormData) {
  try {
    const municipalityId = formData.get("municipalityId") as string;
    const municipalityName = formData.get("municipalityName") as string;
    const adminFullName = formData.get("adminFullName") as string;
    const adminEmail = formData.get("adminEmail") as string;
    const adminPassword = formData.get("adminPassword") as string; // Optional

    if (!municipalityId || !municipalityName || !adminFullName || !adminEmail) {
      return { success: false, error: "Dati mancanti" };
    }

    // 1. Aggiorna tabella municipalities
    const { error: munErr } = await supabaseAdmin
      .from("municipalities")
      .update({ name: municipalityName, contact_name: adminFullName })
      .eq("id", municipalityId);
    
    if (munErr) {
      return { success: false, error: `Errore aggiornamento Comune: ${munErr.message}` };
    }

    // 2. Trova l'utente Admin Ente associato
    const { data: adminProfile, error: adminProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("municipality_id", municipalityId)
      .eq("role", "admin_ente")
      .single();

    if (adminProfile && adminProfile.id) {
      const adminId = adminProfile.id;

      // 3. Aggiorna utente Auth
      const updateData: any = { email: adminEmail };
      if (adminPassword && adminPassword.trim().length >= 6) {
        updateData.password = adminPassword;
      }
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(adminId, updateData);
      
      if (authErr) {
        return { success: false, error: `Errore aggiornamento Auth: ${authErr.message}` };
      }

      // 4. Aggiorna profilo
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
 * Elimina un Comune e il suo utente Admin Ente associato.
 */
export async function deleteMunicipalityAndAdmin(formData: FormData) {
  try {
    const municipalityId = formData.get("municipalityId") as string;
    if (!municipalityId) return { success: false, error: "ID Comune mancante" };

    // Trova l'utente Admin Ente associato
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("municipality_id", municipalityId)
      .eq("role", "admin_ente")
      .single();

    // Elimina il Comune dalla tabella (questo causerà CASCADE su eventuali profili e record correlati se FK sono impostate correttamente)
    const { error: munErr } = await supabaseAdmin
      .from("municipalities")
      .delete()
      .eq("id", municipalityId);

    if (munErr) {
      return { success: false, error: `Errore eliminazione Comune: ${munErr.message}` };
    }

    // Se troviamo l'admin, eliminiamo anche da Supabase Auth
    // Se la FK su profiles a municipalities è ON DELETE CASCADE, il profilo è già rimosso, 
    // ma l'utente Auth va sempre rimosso esplicitamente.
    if (adminProfile && adminProfile.id) {
      await supabaseAdmin.auth.admin.deleteUser(adminProfile.id);
    }

    revalidatePath("/admin/superadmin");
    return { success: true };
  } catch (err: any) {
    console.error("deleteMunicipalityAndAdmin – eccezione:", err);
    return { success: false, error: `Errore imprevisto: ${String(err)}` };
  }
}



/**
 * Crea un nuovo operatore per il comune del referente corrente.
 */
/**
 * Crea un nuovo operatore di campo nella tabella operators.
 */
export async function createOperator(formData: FormData) {
  const municipalityId = formData.get("municipality_id") as string;
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const pin = formData.get("pin") as string;
  const referentId = formData.get("referentId") as string;

  if (!referentId) return { error: "Utente non autenticato" };

  // Verifica autorizzazioni
  const { data: referentProfile, error: referentErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", referentId)
    .single();
    
  if (referentErr) return { error: "Impossibile determinare profilo del chiamante" };

  const isSuperAdmin = !referentProfile?.municipality_id;
  const targetMunicipalityId = isSuperAdmin ? municipalityId : referentProfile.municipality_id;

  if (!targetMunicipalityId) return { error: "Comune non valido o mancante" };

  // Hash del PIN
  const salt = await bcrypt.genSalt(10);
  const pinHash = await bcrypt.hash(pin, salt);

  const { data: newOp, error } = await supabaseAdmin.from("operators").insert({
    municipality_id: targetMunicipalityId,
    name,
    phone,
    pin_hash: pinHash,
    is_active: true
  }).select().single();

  if (error) return { error: error.message };

  revalidatePath("/admin/superadmin");
  return { success: true, operator: newOp };
}

/**
 * Recupera la lista degli operatori associati a uno specifico Comune.
 */
export async function getOperatorsByMunicipality(municipalityId: string) {
  if (!municipalityId) return { error: "ID Comune mancante" };
  
  const { data, error } = await supabaseAdmin
    .from("operators")
    .select("*")
    .eq("municipality_id", municipalityId)
    .order("created_at", { ascending: false });
    
  if (error) return { error: error.message };
  
  return { operators: data };
}

/**
 * Aggiorna lo stato is_active dell'operatore.
 */
export async function toggleOperatorStatus(operatorId: string, isActive: boolean) {
  if (!operatorId) return { error: "ID operatore mancante" };
  
  const { error } = await supabaseAdmin
    .from("operators")
    .update({ is_active: isActive })
    .eq("id", operatorId);
    
  if (error) return { error: error.message };
  
  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Elimina un operatore.
 */
export async function deleteOperator(operatorId: string, referentId: string) {
  if (!referentId) return { error: "Utente non autenticato" };

  const { data: referentProfile, error: refErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", referentId)
    .single();
  if (refErr) return { error: "Impossibile verificare l'utente chiamante" };

  const isSuperAdmin = !referentProfile?.municipality_id;

  const { data: targetOperator, error: targetErr } = await supabaseAdmin
    .from("operators")
    .select("municipality_id")
    .eq("id", operatorId)
    .single();
    
  if (targetErr) return { error: "Operatore non trovato" };

  if (!isSuperAdmin && targetOperator.municipality_id !== referentProfile.municipality_id) {
    return { error: "Operazione non autorizzata" };
  }

  const { error: delOp } = await supabaseAdmin.from("operators").delete().eq("id", operatorId);
  if (delOp) return { error: delOp.message };

  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Login operatore di campo.
 */
export async function loginOperator(phone: string, pin: string) {
  if (!phone || !pin) return { error: 'Dati mancanti' };
  const { data: operator } = await supabaseAdmin.from('operators').select('*').eq('phone', phone).single();
  if (!operator) return { error: 'Credenziali non valide' };
  if (!operator.is_active) return { error: 'Utenza disabilitata' };
  const isValid = await bcrypt.compare(pin, operator.pin_hash);
  if (!isValid) return { error: 'Credenziali non valide' };
  return { success: true, operator: { id: operator.id, municipality_id: operator.municipality_id, name: operator.name } };
}
