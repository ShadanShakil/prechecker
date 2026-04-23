import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CAN_REVIEW_ARTWORK } from "@/lib/roles";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await requireRole(CAN_REVIEW_ARTWORK);
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.artwork.update({
    where: { id },
    data: {
      status: parsed.data.decision,
      rejectReason: parsed.data.decision === "REJECTED" ? parsed.data.reason ?? null : null,
      reviewedById: res.session.user.id,
      reviewedAt: new Date(),
    },
  });
  return NextResponse.json({ artwork: updated });
}
