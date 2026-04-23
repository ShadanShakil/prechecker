/**
 * Stage 1 artwork endpoints.
 *
 *  POST /api/artwork        upload a new artwork (Operator/Reviewer/Admin)
 *  GET  /api/artwork        list artworks visible to the current user
 */
import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { artworkDir, ensureDir, safeExt, toPublicUrl, writeBytes } from "@/lib/storage";
import { CAN_UPLOAD_ARTWORK, hasRole } from "@/lib/roles";

export async function GET() {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const artworks = await prisma.artwork.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { words: true, prints: true } },
    },
    take: 200,
  });
  return NextResponse.json({ artworks });
}

export async function POST(req: Request) {
  const res = await requireSession();
  if ("error" in res) return res.error;
  if (!hasRole(res.session.user.role, CAN_UPLOAD_ARTWORK)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = (form.get("title") as string | null)?.trim() || null;
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const artwork = await prisma.artwork.create({
    data: {
      title: title ?? file.name,
      originalPath: "", // filled after save
      uploadedById: res.session.user.id,
    },
  });

  const ext = safeExt(file.name, "png");
  const dir = artworkDir(artwork.id);
  await ensureDir(dir);
  const abs = path.join(dir, `original.${ext}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeBytes(abs, bytes);

  const updated = await prisma.artwork.update({
    where: { id: artwork.id },
    data: { originalPath: abs },
  });
  return NextResponse.json({
    artwork: { ...updated, originalUrl: toPublicUrl(abs) },
  });
}
