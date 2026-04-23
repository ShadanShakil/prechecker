import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CAN_REVIEW_ARTWORK } from "@/lib/roles";

const schema = z.object({
  overrideText: z.string().nullable().optional(),
  isMisspelled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; wordId: string }> },
) {
  const res = await requireRole(CAN_REVIEW_ARTWORK);
  if ("error" in res) return res.error;
  const { wordId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const word = await prisma.oCRWord.update({
    where: { id: wordId },
    data: {
      overrideText: parsed.data.overrideText ?? null,
      isMisspelled: parsed.data.isMisspelled ?? undefined,
    },
  });
  return NextResponse.json({ word });
}
