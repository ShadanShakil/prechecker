import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const [pendingArtwork, approvedArtwork, totalPrints, mismatches, openAlerts] = await Promise.all([
    prisma.artwork.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.artwork.count({ where: { status: "APPROVED" } }),
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "MISMATCH" } }),
    prisma.alert.count({ where: { acknowledgedAt: null } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome, {session.user.name ?? session.user.email}
        </h1>
        <p className="text-sm text-slate-500">
          Role: {ROLE_LABELS[session.user.role]}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pending review" value={pendingArtwork} href="/artwork?status=PENDING_REVIEW" />
        <Stat label="Approved artworks" value={approvedArtwork} href="/artwork?status=APPROVED" />
        <Stat label="Print jobs" value={totalPrints} href="/prints" />
        <Stat label="Mismatches" value={mismatches} href="/prints?verdict=MISMATCH" />
        <Stat label="Open alerts" value={openAlerts} href="/alerts" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Action title="Upload new artwork" href="/artwork/new" desc="Stage 1: OCR + spell check." />
        <Action title="Upload printed carton" href="/prints/new" desc="Stage 2: verify print against approved artwork." />
        <Action title="Review alerts" href="/alerts" desc="Acknowledge detected mismatches." />
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Link>
  );
}

function Action({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{desc}</div>
    </Link>
  );
}
