/**
 * Triggers OCR + spell-check for an artwork.
 * POST /api/artwork/{id}/ocr
 *
 * Pipeline:
 *  1. Normalize the uploaded image to a consistent PNG canvas.
 *  2. Run Tesseract (primary, English + Arabic) to extract word bboxes.
 *  3. Run PaddleOCR (secondary, English-only) in parallel on the same image.
 *  4. Dual-engine vote to suppress Tesseract false-positive misspellings.
 *  5. Persist OCRWord rows and transition the artwork to PENDING_REVIEW.
 */
import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { artworkDir } from "@/lib/storage";
import { normalizeArtwork } from "@/lib/image";
import { recognizeWords } from "@/lib/ocr";
import { paddleWords } from "@/lib/ocr-paddle";
import { voteWords } from "@/lib/ocr-vote";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const artwork = await prisma.artwork.findUnique({ where: { id } });
  if (!artwork) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!artwork.originalPath) {
    return NextResponse.json({ error: "Artwork has no source file" }, { status: 400 });
  }

  const normalized = path.join(artworkDir(artwork.id), "normalized.png");
  try {
    await normalizeArtwork(artwork.originalPath, normalized);
  } catch (err) {
    console.error("[ocr] normalizeArtwork failed", err);
    return NextResponse.json(
      { error: "Unable to process image — only raster formats (PNG/JPG/WebP) are supported in this MVP." },
      { status: 400 },
    );
  }

  // Run both engines in parallel. PaddleOCR is wrapped in try/catch inside
  // the module so a model-load failure just yields an empty array and we
  // fall back cleanly to Tesseract-only.
  const [tesseractOut, paddleOut] = await Promise.all([
    recognizeWords(normalized),
    paddleWords(normalized),
  ]);

  const voted = await voteWords(tesseractOut, paddleOut);

  await prisma.$transaction([
    prisma.oCRWord.deleteMany({ where: { artworkId: artwork.id } }),
    prisma.oCRWord.createMany({
      data: voted.map((w) => ({
        artworkId: artwork.id,
        text: w.text,
        language: w.language === "other" ? "other" : w.language,
        bboxX: Math.round(w.bbox.x),
        bboxY: Math.round(w.bbox.y),
        bboxW: Math.round(w.bbox.w),
        bboxH: Math.round(w.bbox.h),
        confidence: w.confidence,
        isMisspelled: w.isMisspelled,
        suggestions:
          w.suggestions.length > 0 ? JSON.stringify(w.suggestions) : null,
      })),
    }),
    prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        normalizedPath: normalized,
        status: "PENDING_REVIEW",
      },
    }),
  ]);

  const misspelledCount = voted.filter((w) => w.isMisspelled).length;
  return NextResponse.json({
    ok: true,
    totalWords: voted.length,
    misspelledCount,
    engines: {
      tesseract: tesseractOut.length,
      paddle: paddleOut.length,
    },
  });
}
