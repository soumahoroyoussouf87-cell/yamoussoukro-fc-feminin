/**
 * Réduit une photo côté navigateur avant envoi (connexions limitées) :
 * 800 px max, WebP qualité 0,85. Retourne le fichier d'origine en cas d'échec.
 */
export async function compressImage(file: File, max = 800): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function compressInput(input: HTMLInputElement) {
  const file = input.files?.[0];
  if (!file) return;
  const small = await compressImage(file);
  if (small !== file) {
    const dt = new DataTransfer();
    dt.items.add(small);
    input.files = dt.files;
  }
}
