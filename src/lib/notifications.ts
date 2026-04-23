import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function notifyAdminsOfMismatch(opts: {
  printJobId: string;
  artworkTitle: string;
  diffScore: number;
}): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  const message = `Carton print for "${opts.artworkTitle}" flagged as MISMATCH (diff ${(opts.diffScore * 100).toFixed(2)}%).`;
  const link = `/prints/${opts.printJobId}`;

  // In-app notifications for each admin.
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: "Printed carton mismatch",
      body: message,
      link,
    })),
  });

  // Alert row for the print job.
  await prisma.alert.create({
    data: {
      printJobId: opts.printJobId,
      severity: "HIGH",
      message,
    },
  });

  // Optional email (only if SMTP is configured).
  const t = getTransporter();
  const emails = (process.env.ADMIN_ALERT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (t && emails.length > 0) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM ?? "Carton QC <noreply@example.com>",
        to: emails.join(","),
        subject: "[Carton QC] Print mismatch detected",
        text: `${message}\n\nReview: ${process.env.NEXTAUTH_URL ?? ""}${link}\n`,
      });
    } catch (err) {
      console.error("[notifications] Failed to send email:", err);
    }
  }
}
