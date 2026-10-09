import type { RGBAImage } from "@origo/sdk";

/** Decodes an image URL into raw RGBA pixels for hashing. EXIF orientation is applied by the browser. */
export async function loadRGBA(url: string): Promise<RGBAImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  const bitmap = await createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width, height, data };
}
