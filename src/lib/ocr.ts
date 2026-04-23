/**
 * Server-side OCR using tesseract.js.
 *
 * We run tesseract.js in Node with both English and Arabic language packs.
 * Workers are expensive to spin up, so we initialize them lazily on the
 * first call and reuse them across requests.
 *
 * Input is a path to an image file on disk (we ensure artwork gets
 * rasterized to a PNG before OCR — see `normalizeArtwork`).
 */
import { createWorker, type Worker } from "tesseract.js";

export type OCRWord = {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
};

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    // Load both English and Arabic traineddata. tesseract.js will download
    // the models on first use and cache them to disk under `/tmp`.
    const w = await createWorker(["eng", "ara"]);
    return w;
  })();
  return workerPromise;
}

export async function recognizeWords(imagePath: string): Promise<OCRWord[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(
    imagePath,
    {},
    { blocks: true },
  );
  const words: OCRWord[] = [];
  const blocks = data.blocks ?? [];
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = (word.text ?? "").trim();
          if (!text) continue;
          const bbox = word.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
          words.push({
            text,
            confidence: word.confidence ?? 0,
            bbox: {
              x: bbox.x0 ?? 0,
              y: bbox.y0 ?? 0,
              w: (bbox.x1 ?? 0) - (bbox.x0 ?? 0),
              h: (bbox.y1 ?? 0) - (bbox.y0 ?? 0),
            },
          });
        }
      }
    }
  }
  return words;
}

export async function shutdownOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise;
  await w.terminate();
  workerPromise = null;
}
