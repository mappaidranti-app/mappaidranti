"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";

// Client standard (no auth) per operazioni di amministrazione
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Ottiene il ruolo dell'utente bypassando RLS, usando l'ID utente passato dal client.
 */
export async function getUserRole(userId: string) {
  if (!userId) return { role: null };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return { role: profile?.role || null };
}

/**
 * Ottiene i dati per la dashboard bypassando RLS.
 * Se l'utente non ha municipality_id è un super-admin: vede tutti i comuni.
 */
export async function getDashboardData(userId: string) {
  if (!userId) return { error: "Non autenticato" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, municipality_id")
    .eq("id", userId)
    .single();

  if (profile?.role !== "referent") return { error: "Non autorizzato" };

  const isSuperAdmin = !profile?.municipality_id;
  const municipalityId = profile?.municipality_id;

  // Super admin vede tutti i comuni; referente vede solo il suo
  const { data: municipalities } = isSuperAdmin
    ? await supabaseAdmin.from("municipalities").select("*").order("name")
    : await supabaseAdmin.from("municipalities").select("*").eq("id", municipalityId).limit(1);

  const municipality = isSuperAdmin ? null : (municipalities?.[0] || null);

  let operators: { id: string, full_name: string, email: string, created_at: string }[] = [];
  if (municipality) {
    const { data: ops } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("role", "operator")
      .eq("municipality_id", municipality.id)
      .order("created_at", { ascending: false });
    if (ops) operators = ops;
  }

  return { isSuperAdmin, municipalities: municipalities || [], municipality, operators, referentId: userId };
}

/**
 * Crea un nuovo Comune e il suo Referente (solo super admin).
 */
export async function createMunicipality(formData: FormData) {
  const municipalityName = formData.get("municipalityName") as string;
  const referentName = formData.get("referentName") as string;
  const referentEmail = formData.get("referentEmail") as string;
  const referentPassword = formData.get("referentPassword") as string;
  const callerUserId = formData.get("callerUserId") as string;

  if (!callerUserId) return { error: "Utente non autenticato" };

  // Verifica che sia super admin
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, municipality_id")
    .eq("id", callerUserId)
    .single();

  if (callerProfile?.role !== "referent" || callerProfile?.municipality_id)
    return { error: "Non autorizzato: solo il super admin può creare comuni" };

  // Crea il record del comune
  const { data: newMunicipality, error: munErr } = await supabaseAdmin
    .from("municipalities")
    .insert({ name: municipalityName, contact_name: referentName })
    .select()
    .single();

  if (munErr) return { error: munErr.message };

  // Crea l'utente Supabase per il referente
  const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email: referentEmail,
    password: referentPassword,
    email_confirm: true,
    phone_confirm: false,
  });

  if (userErr) {
    // Rollback: elimina il comune appena creato
    await supabaseAdmin.from("municipalities").delete().eq("id", newMunicipality.id);
    return { error: userErr.message };
  }

  // Crea il profilo del referente
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: newUser.user.id,
    role: "referent",
    municipality_id: newMunicipality.id,
    full_name: referentName,
    email: referentEmail,
  });

  if (profileErr) return { error: profileErr.message };

  revalidatePath("/dashboard");
  return { success: true, municipality: newMunicipality };
}

/**
 * Crea un nuovo operatore per il comune del referente corrente.
 */
export async function createOperator(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const referentId = formData.get("referentId") as string; // Passato dal form

  if (!referentId) return { error: "Utente non autenticato" };

  // Ottieni profilo del referente
  const { data: referentProfile, error: referentErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", referentId)
    .single();
    
  if (referentErr || !referentProfile?.municipality_id)
    return { error: "Impossibile determinare comune del referente" };

  // Crea l'utente Supabase
  const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone_confirm: false,
  });

  if (userErr) return { error: userErr.message };

  // Inserisci il profilo operativo
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: newUser.user.id,
    role: "operator",
    municipality_id: referentProfile.municipality_id,
    full_name: fullName,
    email,
  });

  if (profileErr) return { error: profileErr.message };

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Elimina un operatore appartenente allo stesso comune del referente.
 */
export async function deleteOperator(operatorId: string, referentId: string) {
  if (!referentId) return { error: "Utente non autenticato" };

  // Controlla che l'operatore appartenga allo stesso comune
  const { data: referentProfile, error: refErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", referentId)
    .single();
  if (refErr) return { error: "Impossibile verificare il referente" };

  const { data: targetProfile, error: targetErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id, role")
    .eq("id", operatorId)
    .single();
  if (targetErr) return { error: "Operatore non trovato" };

  if (targetProfile.role !== "operator" || targetProfile.municipality_id !== referentProfile.municipality_id) {
    return { error: "Operazione non autorizzata" };
  }

  // Prima elimina il profilo, poi l'utente Supabase
  const { error: delProfile } = await supabaseAdmin.from("profiles").delete().eq("id", operatorId);
  if (delProfile) return { error: delProfile.message };

  const { error: delUser } = await supabaseAdmin.auth.admin.deleteUser(operatorId);
  if (delUser) return { error: delUser.message };

  revalidatePath("/dashboard");
  return { success: true };
}
