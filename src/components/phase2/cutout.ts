"use client";

/**
 * Détourage simple des photos d'identité sur fond uni (blanc, gris clair…), dans le navigateur.
 * On estime la couleur du fond sur le bord de l'image, puis on rend transparents les pixels
 * de cette couleur reliés au bord (remplissage par diffusion) : le visage et le maillot sont conservés.
 * Si le bord n'est pas uniforme (fond chargé), on renonce et la photo reste telle quelle.
 */
export async function cutout(src: string, opts: { tolerance?: number; maxSide?: number } = {}): Promise<string | null> {
  const tol = opts.tolerance ?? 60;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const ratio = Math.min(1, (opts.maxSide ?? 640) / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // Couleur du fond : médiane des pixels des bords haut, gauche et droit (le bas est souvent le maillot).
  const border: number[][] = [];
  for (let x = 0; x < w; x += 2) border.push(px(d, x, 0, w));
  for (let y = 0; y < h * 0.7; y += 2) { border.push(px(d, 0, y, w)); border.push(px(d, w - 1, y, w)); }
  const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])));
  const close = (i: number) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) < tol;
  const uniform = border.filter((p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) < tol).length / border.length;
  if (uniform < 0.7) return null;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => { const k = y * w + x; if (!seen[k] && close(k * 4)) { seen[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) seed(x, 0);
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  // Fond transparent, et contour adouci (pixels voisins du fond à demi transparents).
  for (let k = 0; k < w * h; k++) if (seen[k]) d[k * 4 + 3] = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    if (seen[k]) continue;
    const n = seen[k - 1] + seen[k + 1] + seen[k - w] + seen[k + w];
    if (n) d[k * 4 + 3] = Math.round(255 * (1 - n / 6));
  }
  ctx.putImageData(im, 0, 0);
  return canvas.toDataURL("image/png");
}

function px(d: Uint8ClampedArray, x: number, y: number, w: number) {
  const i = (Math.floor(y) * w + Math.floor(x)) * 4;
  return [d[i], d[i + 1], d[i + 2]];
}
function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 255;
}
