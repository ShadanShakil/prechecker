import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { session } as const;
}

export async function requireRole(allowed: Role[]) {
  const res = await requireSession();
  if ("error" in res) return res;
  if (!allowed.includes(res.session.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { session: res.session } as const;
}
