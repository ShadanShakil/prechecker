/**
 * Run image comparison for a print job against its approved artwork.
 * POST /api/prints/{id}/analyze
 *
 * Stage 2 pipeline (new in PR #2):
 *  1. ORB + homography alignment (falls back to contain-fit if too few
 *     feature matches).
 *  2. Per-pixel absolute-difference thresholding + morphological noise
 *     filtering.
 *  3. Connected-component analysis → list of defect regions with bounding
 *     boxes and severity.
 *  4. Overlay regions on the artwork for the diff preview.
 *
 * The full structured result is persisted to report.json and key numbers
 * (`diffScore`, `defectCount`, `alignmentMethod`, `goodMatches`) are stored
 * on the PrintJob row for dashboard queries.
 */
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { printDir } from "@/lib/storage";
import { alignAndDiff } from "@/lib/cv";
import { notifyAdminsOfMismatch } from "@/lib/notifications";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const job = await prisma.printJob.findUnique({
    where: { id },
    include: { artwork: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!job.artwork.normalizedPath) {
    return NextResponse.json(
      { error: "Artwork has not been processed yet" },
      { status: 409 },
    );
  }

  const dir = printDir(job.id);
  const alignedPath = path.join(dir, "aligned.png");
  const diffPath = path.join(dir, "diff.png");
  const threshold = Number(process.env.QC_MISMATCH_THRESHOLD ?? "0.02");

  let result;
  try {
    result = await alignAndDiff({
      artworkPath: job.artwork.normalizedPath,
      printPath: job.originalPath,
      alignedOutPath: alignedPath,
      diffOutPath: diffPath,
      mismatchThreshold: isFinite(threshold) ? threshold : 0.02,
      maskPath: job.artwork.printableMaskPath,
    });
  } catch (err) {
    console.error("[prints/analyze] diff failed", err);
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }

  const reportPath = path.join(dir, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2));

  const updated = await prisma.printJob.update({
    where: { id: job.id },
    data: {
      status: result.verdict,
      diffScore: result.diffScore,
      verdict: result.verdict,
      alignedPath,
      diffPath,
      reportJsonPath: reportPath,
      defectCount: result.regions.length,
      alignmentMethod: result.alignmentMethod,
      goodMatches: result.goodMatches,
      alignmentConfidence: result.alignmentConfidence,
      maskedDiffScore: result.maskedDiffScore,
      globalDiffScore: result.globalDiffScore,
      statusReason: result.statusReason,
    },
  });

  if (result.verdict === "MISMATCH") {
    await notifyAdminsOfMismatch({
      printJobId: job.id,
      artworkTitle: job.artwork.title,
      diffScore: result.diffScore,
    });
  }

  return NextResponse.json({ print: updated, result });
}
