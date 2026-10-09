import type { RGBAImage } from "@origo/sdk";

/** Decodes an image URL into raw RGBA pixels for hashing. EXIF orientation is applied by the browser. */
export async function loadRGBA(url: string): Promise<RGBAImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return blobToRGBA(await res.blob());
}

/**
 * Decodes a picked or dropped file. Throws a readable error for files the browser cannot decode.
 * Colors are converted to sRGB (the browser default), the same as sharp does in Node, so a photo
 * hashes the same way here and in the scripts that registered the fixtures (GAPS.md G14).
 */
export async function blobToRGBA(blob: Blob): Promise<RGBAImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    const name = blob instanceof File ? blob.name.toLowerCase() : "";
    if (/hei[cf]/.test(blob.type) || /\.hei[cf]$/.test(name)) {
      throw new Error("This is an iPhone HEIC photo, which this browser cannot open. Use Safari, or export it as JPEG first.");
    }
    throw new Error("This file is not an image the browser can open. Try a JPEG, PNG or WebP.");
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width, height, data };
}
