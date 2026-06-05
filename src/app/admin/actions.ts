"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Inizializza il client Supabase con i privilegi di amministratore
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Nota: in un'implementazione più avanzata utilizzeremmo @supabase/ssr
// per recuperare i cookie e verificare la sessione con un client standard.

export async function createOperator(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const referentId = formData.get("referentId") as string;
    const municipalityId = formData.get("municipalityId") as string;

    if (!email || !password || !fullName || !referentId || !municipalityId) {
      return { error: "Compila tutti i campi richiesti" };
    }

    // Nota di sicurezza: idealmente in un sistema reale, qui dovremmo estrarre il token 
    // della sessione del referente dai cookie (usando @supabase/ssr) per verificare 
    // criptograficamente che la richiesta arrivi davvero da lui. 
    // Dato il vincolo "nessun middleware" e architettura semplificata, ci affidiamo al client admin.
    
    // Controlliamo che il chiamante (referentId) sia davvero un referente
    const { data: referentData, error: referentError } = await supabaseAdmin
      .from("profiles")
      .select("role, municipality_id")
      .eq("id", referentId)
      .single();

    if (referentError || referentData?.role !== "referent" || referentData?.municipality_id !== municipalityId) {
      return { error: "Non hai i permessi per creare un operatore in questo Comune." };
    }

    // 1. Crea l'utente nel sistema di Auth di Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-conferma per evitare verifica via email
    });

    if (authError) {
      return { error: authError.message };
    }

    const newUserId = authData.user.id;

    // 2. Aggiorna il profilo per definirlo come Operatore e collegarlo al Comune
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "operator",
        full_name: fullName,
        email: email,
        municipality_id: municipalityId,
      })
      .eq("id", newUserId); // Il record viene creato in automatico da un trigger Supabase, oppure dobbiamo fare un upsert

    // Se l'ID non esiste (no trigger), facciamo un INSERT/UPSERT
    if (profileError) {
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newUserId,
          role: "operator",
          full_name: fullName,
          email: email,
          municipality_id: municipalityId,
        });
      
      if (insertError) {
        // Tentiamo un rollback cancellando l'utente se la profilazione fallisce
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return { error: "Errore durante il salvataggio del profilo dell'operatore." };
      }
    }

    // Ricarica la pagina per mostrare i dati aggiornati
    revalidatePath("/admin");
    return { success: true };

  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: "Errore sconosciuto" };
  }
}
