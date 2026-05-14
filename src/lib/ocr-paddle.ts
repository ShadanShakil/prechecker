/**
 * Secondary OCR engine: PaddleOCR (PP-OCRv4) via ONNX Runtime, wrapped by
 * @gutenye/ocr-node. Fully offline, no Python sidecar.
 *
 * PP-OCRv4 is dramatically better than Tesseract on designed/stylised
 * English type (display fonts, outlined text, text on noisy backgrounds)
 * which is exactly the carton-artwork case. We use it to cross-check
 * Tesseract's output and suppress bogus misspellings before we flag
 * them to the reviewer.
 *
 * Note: the bundled PP-OCRv4 model is English + Chinese. Arabic has its
 * own dedicated recogniser which we don't ship here — Arabic OCR remains
 * Tesseract-only for now, with reviewer-in-the-loop.
 */
// Lazy-initialised instance; ONNX runtime takes a second or two to spin up.
type OcrInstance = {
  detect: (imagePath: string) => Promise<unknown>;
};
let instancePromise: Promise<OcrInstance | null> | null = null;

export type PaddleLineDetection = {
  text: string;
  /** PaddleOCR "mean" confidence — 0..1. */
  confidence: number;
  /** Axis-aligned bounding box derived from the 4-corner polygon. */
  bbox: { x: number; y: number; w: number; h: number };
};

async function getInstance(): Promise<OcrInstance | null> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    try {
      const mod = (await import("@gutenye/ocr-node")) as unknown as {
        default: { create: (opts?: Record<string, unknown>) => Promise<OcrInstance> };
      };
      return await mod.default.create({});
    } catch (err) {
      console.error("[ocr-paddle] failed to initialise", err);
      return null;
    }
  })();
  return instancePromise;
}

type PaddleRawDetection = {
  text: string;
  mean: number;
  box: Array<[number, number]>;
};

function polyToBbox(poly: Array<[number, number]>): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.round(maxX - minX),
    h: Math.round(maxY - minY),
  };
}

/**
 * Run PaddleOCR on an image path. Returns an array of detected lines
 * (PaddleOCR works line-by-line, not word-by-word — we split into words
 * downstream using whitespace so the bboxes are approximate at the word
 * level).
 */
export async function paddleDetect(
  imagePath: string,
): Promise<PaddleLineDetection[]> {
  const ocr = await getInstance();
  if (!ocr) return [];
  try {
    const raw = (await ocr.detect(imagePath)) as PaddleRawDetection[];
    return raw.map((r) => ({
      text: r.text,
      confidence: r.mean,
      bbox: polyToBbox(r.box),
    }));
  } catch (err) {
    console.error("[ocr-paddle] detect failed", err);
    return [];
  }
}

/** Split a Paddle line detection into word-level detections. */
export function paddleWordsFromLine(line: PaddleLineDetection): PaddleLineDetection[] {
  const tokens = line.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return [line];
  // Width-weighted word boxes — rough, but good enough for cross-checking.
  const totalChars = line.text.length || 1;
  let cursor = line.bbox.x;
  const perChar = line.bbox.w / totalChars;
  const out: PaddleLineDetection[] = [];
  for (const tok of tokens) {
    const w = Math.max(1, Math.round(tok.length * perChar));
    out.push({
      text: tok,
      confidence: line.confidence,
      bbox: { x: Math.round(cursor), y: line.bbox.y, w, h: line.bbox.h },
    });
    cursor += w + perChar; // plus a space
  }
  return out;
}

/** Convenience: full page → word-level detections in one call. */
export async function paddleWords(
  imagePath: string,
): Promise<PaddleLineDetection[]> {
  const lines = await paddleDetect(imagePath);
  return lines.flatMap(paddleWordsFromLine);
}
