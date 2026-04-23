/**
 * Register endpoint for the MVP. We only allow admins to create new users
 * once the system is seeded, but the very first user can always register
 * (they automatically become the admin).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

const roleEnum = z.enum(["ADMIN", "REVIEWER", "QC_INSPECTOR", "OPERATOR"]);

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
  role: roleEnum.optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingCount = await prisma.user.count();
  const session = await auth();

  let role: Role;
  if (existingCount === 0) {
    // Bootstrap: first user becomes admin.
    role = "ADMIN";
  } else if (session?.user?.role === "ADMIN") {
    role = parsed.data.role ?? "OPERATOR";
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      hashedPassword,
      name: parsed.data.name,
      role,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
