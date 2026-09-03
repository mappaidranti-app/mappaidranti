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
}

/**
 * Crea un nuovo Comune e il suo Referente (solo super admin).
 */
export async function createMunicipality(formData: FormData) {
  const municipalityName = formData.get("municipalityName") as string;
  const province = formData.get("province") as string;
  const notes = formData.get("notes") as string;
  
  const ref1Name = formData.get("ref1Name") as string;
  const ref1Role = formData.get("ref1Role") as string;
  const ref1Phone = formData.get("ref1Phone") as string;
  const ref1Email = formData.get("ref1Email") as string;
  
  const ref2Name = formData.get("ref2Name") as string;
  const ref2Role = formData.get("ref2Role") as string;
  const ref2Phone = formData.get("ref2Phone") as string;
  const ref2Email = formData.get("ref2Email") as string;

  const adminName = formData.get("adminName") as string;
  const adminEmail = formData.get("adminEmail") as string;
  const adminPassword = formData.get("adminPassword") as string;
  
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
    .single();

  if (munErr) return { error: munErr.message };

  // Crea l'utente Supabase per il referente
  const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    phone_confirm: false,
  });

  if (userErr) {
    // Rollback: elimina il comune appena creato
    await supabaseAdmin.from("municipalities").delete().eq("id", newMunicipality.id);
    return { error: userErr.message };
  }

  // Crea il profilo del referente (Admin Ente)
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: newUser.user.id,
    role: "referent",
    municipality_id: newMunicipality.id,
    full_name: adminName,
    email: adminEmail,
  });

  if (profileErr) return { error: profileErr.message };

  revalidatePath("/admin/superadmin");
  return { success: true, municipality: newMunicipality };
}

/**
 * Aggiorna i dati di un Comune esistente (solo super admin).
 */
export async function updateMunicipality(formData: FormData) {
  const municipalityId = formData.get("municipalityId") as string;
  const callerUserId = formData.get("callerUserId") as string;

  if (!callerUserId || !municipalityId) return { error: "Dati mancanti o utente non autenticato" };

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, municipality_id")
    .eq("id", callerUserId)
    .single();

  if (callerProfile?.role !== "referent" || callerProfile?.municipality_id)
    return { error: "Non autorizzato: solo il super admin può modificare i comuni" };

  const { error } = await supabaseAdmin
    .from("municipalities")
    .update({
      name: formData.get("municipalityName") as string,
      province: formData.get("province") as string,
      notes: formData.get("notes") as string,
      ref1_name: formData.get("ref1Name") as string,
      ref1_role: formData.get("ref1Role") as string,
      ref1_phone: formData.get("ref1Phone") as string,
      ref1_email: formData.get("ref1Email") as string,
      ref2_name: formData.get("ref2Name") as string,
      ref2_role: formData.get("ref2Role") as string,
      ref2_phone: formData.get("ref2Phone") as string,
      ref2_email: formData.get("ref2Email") as string,
    })
    .eq("id", municipalityId);

  if (error) return { error: error.message };

  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Crea un nuovo operatore per il comune del referente corrente.
 */
export async function createOperator(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const referentId = formData.get("referentId") as string;
  const formMunicipalityId = formData.get("municipalityId") as string;

  if (!referentId) return { error: "Utente non autenticato" };

  // Ottieni profilo del chiamante
  const { data: referentProfile, error: referentErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", referentId)
    .single();
    
  if (referentErr) return { error: "Impossibile determinare profilo del chiamante" };

  const isSuperAdmin = !referentProfile?.municipality_id;
  const targetMunicipalityId = isSuperAdmin ? formMunicipalityId : referentProfile.municipality_id;

  if (!targetMunicipalityId) return { error: "Comune non valido o mancante" };

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
    municipality_id: targetMunicipalityId,
    full_name: fullName,
    email,
  });

  if (profileErr) return { error: profileErr.message };

  revalidatePath("/admin/superadmin");
  return { success: true };
}

/**
 * Elimina un operatore. Il Super Admin può eliminare tutti, il referente solo i propri.
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

  const { data: targetProfile, error: targetErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id, role")
    .eq("id", operatorId)
    .single();
  if (targetErr) return { error: "Operatore non trovato" };

  if (targetProfile.role !== "operator" || (!isSuperAdmin && targetProfile.municipality_id !== referentProfile.municipality_id)) {
    return { error: "Operazione non autorizzata" };
  }

  // Prima elimina il profilo, poi l'utente Supabase
  const { error: delProfile } = await supabaseAdmin.from("profiles").delete().eq("id", operatorId);
  if (delProfile) return { error: delProfile.message };

  const { error: delUser } = await supabaseAdmin.auth.admin.deleteUser(operatorId);
  if (delUser) return { error: delUser.message };

  revalidatePath("/admin/superadmin");
  return { success: true };
}
