/**
 * Triggers OCR + spell-check for an artwork.
 * POST /api/artwork/{id}/ocr
 *
 * We normalize the uploaded image to a consistent PNG, run tesseract.js
 * (English + Arabic), spell-check each detected word, and persist the
 * resulting OCRWord rows. The response returns the words so the UI can
 * immediately render them.
 */
import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { artworkDir } from "@/lib/storage";
import { normalizeArtwork } from "@/lib/image";
import { recognizeWords } from "@/lib/ocr";
import { checkWord } from "@/lib/spellcheck";

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

  const words = await recognizeWords(normalized);

  // Spell check each non-trivial word.
  const checked = await Promise.all(
    words.map(async (w) => {
      if (!w.text || w.text.length < 2) {
        return { ...w, isMisspelled: false, language: "other" as const, suggestions: [] as string[] };
      }
      const result = await checkWord(w.text);
      return {
        ...w,
        isMisspelled: result.isMisspelled,
        language: result.language,
        suggestions: result.suggestions,
      };
    }),
  );

  // Replace existing OCRWord rows atomically.
  await prisma.$transaction([
    prisma.oCRWord.deleteMany({ where: { artworkId: artwork.id } }),
    prisma.oCRWord.createMany({
      data: checked.map((w) => ({
        artworkId: artwork.id,
        text: w.text,
        language: w.language === "other" ? "other" : w.language,
        bboxX: Math.round(w.bbox.x),
        bboxY: Math.round(w.bbox.y),
        bboxW: Math.round(w.bbox.w),
        bboxH: Math.round(w.bbox.h),
        confidence: w.confidence,
        isMisspelled: w.isMisspelled,
        suggestions: w.suggestions.length > 0 ? JSON.stringify(w.suggestions) : null,
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

  const misspelledCount = checked.filter((w) => w.isMisspelled).length;
  return NextResponse.json({
    ok: true,
    totalWords: checked.length,
    misspelledCount,
  });
}
