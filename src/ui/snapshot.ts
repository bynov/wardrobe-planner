/** Viewport background, painted under the (possibly transparent) WebGL frame before encoding. */
const BACKDROP = '#f0f2f5';
export const SNAPSHOT_MAX_WIDTH = 900;
export const SNAPSHOT_QUALITY = 0.85;

let source: (() => HTMLCanvasElement) | null = null;
let lastSnapshot: string | null = null;

/** Registered by the 3D viewport while mounted. */
export function setSnapshotSource(fn: (() => HTMLCanvasElement) | null): void {
  source = fn;
}

/**
 * Downscaled JPEG data URL: a full-resolution PNG bloated the PDF far past the drawings.
 * Exported because the off-screen renderer captures its own canvas rather than the live one.
 */
export function encodeCanvas(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, SNAPSHOT_MAX_WIDTH / Math.max(1, canvas.width));
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(canvas.width * scale));
  off.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = off.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/jpeg', SNAPSHOT_QUALITY);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(canvas, 0, 0, off.width, off.height);
  return off.toDataURL('image/jpeg', SNAPSHOT_QUALITY);
}

/**
 * Captures the live canvas and remembers it. The viewport calls this whenever the model settles
 * and once more on unmount, so an export started from the design or cut-list tab — where the 3D
 * canvas does not exist — still gets the picture the user last saw.
 */
export function cacheSnapshot(): string | null {
  if (!source) return lastSnapshot;
  try {
    lastSnapshot = encodeCanvas(source());
  } catch {
    // a lost context or a tainted canvas: keep whatever was cached before
  }
  return lastSnapshot;
}

/**
 * Forgets the cached picture. A new or imported project has nothing to do with the wardrobe the
 * last snapshot shows, and exporting it from the design tab printed the previous project's 3D view.
 */
export function clearSnapshot(): void {
  lastSnapshot = null;
}
