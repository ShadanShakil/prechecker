import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CAN_ACK_ALERTS } from "@/lib/roles";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await requireRole(CAN_ACK_ALERTS);
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const alert = await prisma.alert.update({
    where: { id },
    data: {
      acknowledgedById: res.session.user.id,
      acknowledgedAt: new Date(),
    },
  });
  return NextResponse.json({ alert });
}
