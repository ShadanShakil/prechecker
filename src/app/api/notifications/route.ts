import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const res = await requireSession();
  if ("error" in res) return res.error;
  const notifications = await prisma.notification.findMany({
    where: { userId: res.session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ notifications });
}
