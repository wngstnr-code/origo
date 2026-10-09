/** Plain RGBA image, row-major, `data.length === width * height * 4`. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Integer rectangle in pixel coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Thrown when an image has fewer than 32 pixels in either dimension. */
export class ImageTooSmallError extends Error {
  constructor(message = "Image must be at least 32 x 32 pixels") {
    super(message);
    this.name = "ImageTooSmallError";
  }
}
