import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "password";

const USERS = [
  { email: "admin@carton.local", name: "Admin", role: "ADMIN" as const },
  { email: "reviewer@carton.local", name: "Rima Reviewer", role: "REVIEWER" as const },
  { email: "qc@carton.local", name: "Qasim QC", role: "QC_INSPECTOR" as const },
  { email: "operator@carton.local", name: "Omar Operator", role: "OPERATOR" as const },
];

async function main() {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        hashedPassword,
      },
    });
  }
  console.log(`Seeded ${USERS.length} users. Password for all: "${DEFAULT_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
