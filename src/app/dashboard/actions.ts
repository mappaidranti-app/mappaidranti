"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";

// Client standard (no auth) per operazioni di amministrazione
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Crea un nuovo operatore per il comune del referente corrente.
 */
export async function createOperator(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  // Verifica sessione del referente
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  if (!session) return { error: "Utente non autenticato" };

  // Ottieni profilo del referente
  const { data: referentProfile, error: referentErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", session.user.id)
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
export async function deleteOperator(operatorId: string) {
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  if (!session) return { error: "Utente non autenticato" };

  // Controlla che l'operatore appartenga allo stesso comune
  const { data: referentProfile, error: refErr } = await supabaseAdmin
    .from("profiles")
    .select("municipality_id")
    .eq("id", session.user.id)
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
