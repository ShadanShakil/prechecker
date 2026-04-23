/**
 * Run image comparison for a print job against its approved artwork.
 * POST /api/prints/{id}/analyze
 */
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { printDir } from "@/lib/storage";
import { diffPrintAgainstArtwork } from "@/lib/image";
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
    result = await diffPrintAgainstArtwork({
      artworkNormalizedPath: job.artwork.normalizedPath,
      printOriginalPath: job.originalPath,
      alignedOutPath: alignedPath,
      diffOutPath: diffPath,
      mismatchThreshold: isFinite(threshold) ? threshold : 0.02,
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
