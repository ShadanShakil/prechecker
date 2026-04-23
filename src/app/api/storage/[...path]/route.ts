/**
 * Serve files stored under STORAGE_ROOT. Requires an authenticated session.
 * We deliberately do NOT use a signed URL scheme for the MVP — any logged-in
 * user can view any stored asset by path. Swap this for a per-resource ACL
 * check if that becomes a concern.
 */
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { resolveFromStorage } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  json: "application/json",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  const abs = resolveFromStorage(rel);
  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
