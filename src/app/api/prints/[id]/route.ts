import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { toPublicUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const job = await prisma.printJob.findUnique({
    where: { id },
    include: {
      artwork: {
        select: { id: true, title: true, normalizedPath: true, originalPath: true },
      },
      uploadedBy: { select: { id: true, name: true, email: true } },
      alerts: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    print: {
      ...job,
      originalUrl: job.originalPath ? toPublicUrl(job.originalPath) : null,
      alignedUrl: job.alignedPath ? toPublicUrl(job.alignedPath) : null,
      diffUrl: job.diffPath ? toPublicUrl(job.diffPath) : null,
      artwork: job.artwork
        ? {
            ...job.artwork,
            normalizedUrl: job.artwork.normalizedPath
              ? toPublicUrl(job.artwork.normalizedPath)
              : null,
          }
        : null,
    },
  });
}
