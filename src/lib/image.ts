/**
 * Image utilities:
 *  - normalizeArtwork: rasterize any uploaded file to a high-resolution PNG
 *    so OCR + diff can work on a consistent canvas.
 *  - diffPrintAgainstArtwork: resize the print photo to match the approved
 *    artwork's canvas, pixel-compare via pixelmatch, and produce a diff
 *    overlay + score.
 */
import sharp from "sharp";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_DIM = 2400;

export async function normalizeArtwork(inputPath: string, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  // sharp can read PNG/JPG/WebP/TIFF/etc directly. For PDFs we'd need a
  // separate rasterizer — for MVP we accept raster images only.
  const img = sharp(inputPath, { failOn: "none" });
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error("Unable to read image dimensions — ensure the file is a raster image (PNG/JPG).");
  }
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  await img
    .rotate() // auto-orient via EXIF
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(outputPath);
}

export type DiffResult = {
  diffScore: number; // ratio 0..1 of pixels that differ
  diffPixels: number;
  totalPixels: number;
  width: number;
  height: number;
  verdict: "MATCH" | "MISMATCH";
};

export async function diffPrintAgainstArtwork(opts: {
  artworkNormalizedPath: string;
  printOriginalPath: string;
  alignedOutPath: string;
  diffOutPath: string;
  mismatchThreshold: number; // e.g. 0.02 — 2% of pixels differ
}): Promise<DiffResult> {
  const artworkBuf = await sharp(opts.artworkNormalizedPath).png().toBuffer();
  const artworkPng = PNG.sync.read(artworkBuf);
  const { width, height } = artworkPng;

  // Resize the printed-carton photo to match the approved artwork canvas.
  // We auto-orient via EXIF, fit to the same canvas, and pad with white so
  // pixelmatch compares like-for-like shapes.
  const alignedBuf = await sharp(opts.printOriginalPath, { failOn: "none" })
    .rotate()
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  await fs.mkdir(path.dirname(opts.alignedOutPath), { recursive: true });
  await fs.writeFile(opts.alignedOutPath, alignedBuf);
  const alignedPng = PNG.sync.read(alignedBuf);

  const diffPng = new PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = pixelmatch(
    artworkPng.data,
    alignedPng.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1, includeAA: true, alpha: 0.5 },
  );
  const diffScore = totalPixels > 0 ? diffPixels / totalPixels : 0;
  await fs.mkdir(path.dirname(opts.diffOutPath), { recursive: true });
  await fs.writeFile(opts.diffOutPath, PNG.sync.write(diffPng));
  return {
    diffScore,
    diffPixels,
    totalPixels,
    width,
    height,
    verdict: diffScore > opts.mismatchThreshold ? "MISMATCH" : "MATCH",
  };
}
