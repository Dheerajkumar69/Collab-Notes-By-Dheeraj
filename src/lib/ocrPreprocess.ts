/**
 * OCR pre-processing helpers for the note-creation flow.
 *
 * Goals (Phase 1 — reliability & correctness):
 *  - Convert HEIC/HEIF -> JPEG so Safari/iPhone uploads work everywhere.
 *  - Auto-rotate using EXIF orientation (phone photos are often sideways,
 *    which destroys OCR accuracy).
 *  - Downscale images >2048px on the long edge to ~2048px.
 *  - Strip EXIF metadata for privacy (canvas re-encode does this for free).
 *  - Split multi-page PDFs into per-page JPEGs for parallel OCR.
 */

import imageCompression from 'browser-image-compression';

const MAX_LONG_EDGE = 2048;
export const LOW_RES_THRESHOLD = 600;

/** True if the file extension or mime type looks like HEIC/HEIF. */
function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === 'image/heic' || t === 'image/heif') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/** Convert HEIC/HEIF -> JPEG using heic2any (browser only). */
async function heicToJpeg(file: File): Promise<File> {
  // Dynamic import keeps heic2any out of the main bundle for non-iPhone users.
  // heic2any's published types export the function as the module namespace itself,
  // but the runtime ships a CJS default export — handle both shapes.
  const mod: unknown = await import('heic2any');
  type Heic2AnyFn = (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
  const heic2any =
    (mod as { default?: Heic2AnyFn }).default ?? (mod as Heic2AnyFn);
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
}

export interface PreprocessResult {
  file: File;
  /** Long-edge pixel size after preprocessing, if known. */
  longEdge?: number;
  /** Set when the source image is suspiciously low resolution. */
  lowRes?: boolean;
}

/**
 * Run the full image pipeline: HEIC convert -> auto-rotate via EXIF
 * -> downscale -> strip EXIF. Returns the original file unchanged
 * for non-image inputs.
 */
export async function preprocessImage(file: File): Promise<PreprocessResult> {
  if (!file.type.startsWith('image/') && !isHeic(file)) {
    return { file };
  }

  let working = file;
  if (isHeic(working)) {
    try {
      working = await heicToJpeg(working);
    } catch (err) {
      console.warn('HEIC conversion failed, falling back to original:', err);
    }
  }

  // Skip GIFs (animation would be lost) and SVGs (no raster benefit).
  if (working.type === 'image/gif' || working.type === 'image/svg+xml') {
    return { file: working };
  }

  try {
    const compressed = await imageCompression(working, {
      maxWidthOrHeight: MAX_LONG_EDGE,
      maxSizeMB: 4,
      useWebWorker: true,
      initialQuality: 0.9,
      // exifOrientation handling: the library re-encodes via canvas,
      // which strips EXIF AND bakes in the correct orientation.
      preserveExif: false,
    });

    // Probe final dimensions for the low-res hint.
    const longEdge = await readLongEdge(compressed).catch(() => undefined);
    const out = new File([compressed], working.name, {
      type: compressed.type || 'image/jpeg',
      lastModified: Date.now(),
    });
    return {
      file: out,
      longEdge,
      lowRes: typeof longEdge === 'number' && longEdge < LOW_RES_THRESHOLD,
    };
  } catch (err) {
    console.warn('Image preprocessing failed, using original:', err);
    return { file: working };
  }
}

function readLongEdge(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(Math.max(img.naturalWidth, img.naturalHeight));
    };
    img.onerror = e => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/* -------------------------------------------------------------------------- */
/* PDF splitting                                                              */
/* -------------------------------------------------------------------------- */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(async pdfjs => {
      // Vite-friendly worker URL — pdfjs ships an ESM worker we can resolve at build time.
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export interface PdfPageImage {
  pageNumber: number;
  totalPages: number;
  file: File;
}

/** Render every page of a PDF to a JPEG File (1 file per page). */
export async function splitPdfToImages(file: File): Promise<PdfPageImage[]> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  const baseName = file.name.replace(/\.pdf$/i, '');
  const out: PdfPageImage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    // Pick a scale that puts the long edge near MAX_LONG_EDGE for OCR clarity.
    const longEdge = Math.max(viewport.width, viewport.height);
    const scale = Math.min(2.5, MAX_LONG_EDGE / longEdge);
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context for PDF rendering');
    // White background — many PDFs render with transparency that hurts OCR.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
    );
    out.push({
      pageNumber: i,
      totalPages: total,
      file: new File([blob], `${baseName}-p${i}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }),
    });
  }

  try {
    await doc.destroy();
  } catch {
    /* ignore */
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Concurrency helper                                                         */
/* -------------------------------------------------------------------------- */

/** Run async tasks with bounded concurrency, returning results in order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        const value = await worker(items[idx], idx);
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/* -------------------------------------------------------------------------- */
/* Promise helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Race a promise against a timeout. The provided AbortController is aborted
 * when the timeout fires so the underlying request stops eating resources.
 */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  controller: AbortController,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { controller.abort(); } catch { /* ignore */ }
      reject(new DOMException(`OCR timed out after ${Math.round(ms / 1000)}s`, 'TimeoutError'));
    }, ms);
    p.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}
