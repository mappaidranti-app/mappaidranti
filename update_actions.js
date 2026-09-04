import fs from 'fs';
import path from 'path';

const actionsPath = path.join('d:', 'Progetti Git Hub', 'mappaidranti', 'src', 'app', 'admin', 'actions.ts');
let content = fs.readFileSync(actionsPath, 'utf8');

// We need to add bcryptjs import
const bcryptImport = `import bcrypt from "bcryptjs";\n`;

// Replace createOperator
const newCreateOperator = `/**
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
`;

// Replace from createOperator to end of file
const createOpIndex = content.indexOf('/**\n * Crea un nuovo operatore per il comune del referente corrente.');
if (createOpIndex !== -1) {
    content = content.substring(0, createOpIndex) + newCreateOperator;
}

// Add imports
content = content.replace('import { revalidatePath } from "next/cache";', 'import { revalidatePath } from "next/cache";\n' + bcryptImport);

fs.writeFileSync(actionsPath, content, 'utf8');
console.log('actions.ts updated');
