import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      printJob: { include: { artwork: { select: { id: true, title: true } } } },
      acknowledgedBy: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });
  return NextResponse.json({ alerts });
}
