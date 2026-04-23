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

  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      words: { orderBy: [{ bboxY: "asc" }, { bboxX: "asc" }] },
    },
  });
  if (!artwork) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    artwork: {
      ...artwork,
      originalUrl: artwork.originalPath ? toPublicUrl(artwork.originalPath) : null,
      normalizedUrl: artwork.normalizedPath ? toPublicUrl(artwork.normalizedPath) : null,
    },
  });
}
