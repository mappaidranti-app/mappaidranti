import { supabase } from "@/lib/supabase";

const PHOTO_BUCKET = "hydrant-photos";
const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.8;

/**
 * Riduce la foto prima dell'invio (lato lungo max 1600 px, JPEG 80%):
 * una foto del telefono passa da 3-8 MB a ~300 KB, così il salvataggio
 * funziona anche con poca rete. In caso di problemi si invia l'originale.
 */
export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (err) {
    console.warn("Compressione foto non riuscita, invio l'originale:", err);
    return file;
  }
}

export function buildPhotoPath(file: File) {
  const extension = file.name.split(".").pop() || "jpg";
  return `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
}

/** Riduce e carica una foto nel bucket degli idranti; restituisce l'URL pubblico. */
export async function uploadHydrantPhoto(file: File, label = "foto"): Promise<string> {
  if (!supabase) throw new Error("Supabase non configurato");
  const photo = await compressPhoto(file);
  const path = buildPhotoPath(photo);
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, photo, { upsert: false, contentType: photo.type });
  if (error) throw new Error(`Impossibile caricare la ${label}: ${error.message}`);
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
