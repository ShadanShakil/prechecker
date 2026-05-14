import Link from "next/link";
import {
  ActivitySquare,
  CircleCheck,
  AlertTriangle,
  Activity,
  Upload,
  Focus,
  BellRing,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { StatCard } from "@/components/ui/StatCard";
import { Stepper } from "@/components/ui/Stepper";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  MotionPage,
  MotionStagger,
  MotionItem,
} from "@/components/ui/MotionPage";

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const [
    pendingArtwork,
    approvedArtwork,
    totalPrints,
    matched,
    mismatches,
    openAlerts,
    recentAlerts,
    recentPrints,
    recentArtwork,
    uploadedToday,
    approvedToday,
    flaggedToday,
  ] = await Promise.all([
    prisma.artwork.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.artwork.count({ where: { status: "APPROVED" } }),
    prisma.printJob.count(),
    prisma.printJob.count({ where: { status: "MATCH" } }),
    prisma.printJob.count({ where: { status: "MISMATCH" } }),
    prisma.alert.count({ where: { acknowledgedAt: null } }),
    prisma.alert.findMany({
      where: { acknowledgedAt: null },
      include: { printJob: { include: { artwork: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.printJob.findMany({
      include: { artwork: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.artwork.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.artwork.count({
      where: {
        createdAt: { gte: startOfToday() },
      },
    }),
    prisma.artwork.count({
      where: {
        status: "APPROVED",
        reviewedAt: { gte: startOfToday() },
      },
    }),
    prisma.printJob.count({
      where: {
        status: "MISMATCH",
        createdAt: { gte: startOfToday() },
      },
    }),
  ]);

  const totalAnalyzed = matched + mismatches;
  const qualityHealth =
    totalAnalyzed > 0 ? (matched / totalAnalyzed) * 100 : 100;

  const userName = session.user.name ?? session.user.email ?? "there";
  const firstName = userName.split(/[\s@]/)[0] ?? userName;

  // Decide step states based on most-recent activity.
  const latestArtwork = recentArtwork[0];
  const stepperSteps: Array<{
    n: number;
    label: string;
    href?: string;
    state: "active" | "done" | "todo";
  }> = [
    {
      n: 1,
      label: "Pre-Print Validation",
      href: "/artwork",
      state:
        latestArtwork && latestArtwork.status === "APPROVED" ? "done" : "active",
    },
    {
      n: 2,
      label: "Post-Print Inspection",
      href: "/prints",
      state: totalPrints > 0 ? "done" : "todo",
    },
    {
      n: 3,
      label: "Review Quality Alerts",
      href: "/alerts",
      state: openAlerts > 0 ? "active" : "done",
    },
  ];

  return (
    <MotionPage>
      {/* Welcome banner */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/60 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Welcome to QC Vision{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Start by validating artwork before print production, then inspect
          printed cartons for accuracy. You&apos;re signed in as{" "}
          <span className="font-medium text-slate-900">
            {ROLE_LABELS[session.user.role]}
          </span>
          .
        </p>
        <div className="mt-5">
          <Stepper steps={stepperSteps} />
        </div>
      </div>

      {/* KPI cards */}
      <MotionStagger
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        delay={0.05}
      >
        <MotionItem>
          <StatCard
            value={pendingArtwork}
            label="Active Artwork Queue"
            hint="Awaiting validation"
            icon={<Activity size={18} />}
            iconTone="brand"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={approvedToday}
            label="Approved Today"
            hint="Ready for production"
            icon={<CircleCheck size={18} />}
            iconTone="success"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={openAlerts}
            label="Critical Alerts"
            hint="Requires immediate review"
            icon={<AlertTriangle size={18} />}
            iconTone="danger"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={`${qualityHealth.toFixed(1)}%`}
            label="Quality Health"
            hint="Live production score"
            icon={<ActivitySquare size={18} />}
            iconTone="purple"
          />
        </MotionItem>
      </MotionStagger>

      {/* Action tiles */}
      <MotionStagger
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        delay={0.15}
      >
        <MotionItem>
          <ActionTile
            icon={<Upload size={20} />}
            iconTone="brand"
            title="Start New Artwork Validation"
            desc="Upload artwork for OCR + EN/AR spell check"
            href="/artwork/new"
            cta="Get Started"
            ctaTone="brand"
          />
        </MotionItem>
        <MotionItem>
          <ActionTile
            icon={<Focus size={20} />}
            iconTone="success"
            title="Start New Print Inspection"
            desc="Upload printed carton for comparison"
            href="/prints/new"
            cta="Get Started"
            ctaTone="success"
          />
        </MotionItem>
        <MotionItem>
          <ActionTile
            icon={<BellRing size={20} />}
            iconTone="danger"
            title="Review Quality Alerts"
            desc="Resolve flagged production issues"
            href="/alerts"
            cta="View Alerts"
            ctaTone="danger"
          />
        </MotionItem>
      </MotionStagger>

      {/* Snapshot + Issues */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Production Status Snapshot
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Today&apos;s pipeline</p>
          <div className="mt-5 space-y-4">
            <ProgressBar
              label="Uploaded Today"
              value={uploadedToday}
              max={Math.max(uploadedToday + 4, 10)}
              tone="brand"
              delay={0.1}
            />
            <ProgressBar
              label="Approved"
              value={approvedToday}
              max={Math.max(uploadedToday, approvedToday, 10)}
              tone="success"
              delay={0.18}
            />
            <ProgressBar
              label="Flagged"
              value={flaggedToday}
              max={Math.max(uploadedToday, flaggedToday, 10)}
              tone="danger"
              delay={0.26}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Top Current Issues
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Across all analyzed print jobs
          </p>
          <div className="mt-5 space-y-4">
            <ProgressBar
              label="Mismatches"
              value={mismatches}
              max={Math.max(totalPrints, 10)}
              tone="danger"
              delay={0.1}
            />
            <ProgressBar
              label="Matches"
              value={matched}
              max={Math.max(totalPrints, 10)}
              tone="success"
              delay={0.18}
            />
            <ProgressBar
              label="Open Alerts"
              value={openAlerts}
              max={Math.max(openAlerts + 5, 10)}
              tone="warning"
              delay={0.26}
            />
            <ProgressBar
              label="Pending Artwork"
              value={pendingArtwork}
              max={Math.max(pendingArtwork + approvedArtwork, 10)}
              tone="purple"
              delay={0.34}
            />
          </div>
        </Card>
      </div>

      {/* Live alerts + Recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Live Quality Alerts
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Real-time production issues requiring attention
              </p>
            </div>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {recentAlerts.length === 0 ? (
              <li className="py-8 text-center text-sm text-slate-500">
                No open alerts. Production is clean.
              </li>
            ) : (
              recentAlerts.map((a) => {
                const tone =
                  a.severity === "HIGH"
                    ? "danger"
                    : a.severity === "MEDIUM"
                      ? "warning"
                      : "info";
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    <span
                      className={`inline-block h-2 w-2 flex-none rounded-full ${
                        tone === "danger"
                          ? "bg-rose-500"
                          : tone === "warning"
                            ? "bg-amber-500"
                            : "bg-sky-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/prints/${a.printJobId}`}
                          className="truncate text-sm font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                        >
                          PJ-{a.printJobId.slice(-6).toUpperCase()}
                        </Link>
                        <span className="truncate text-sm text-slate-700">
                          {a.message}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          tone={tone}
                          className="lowercase first-letter:uppercase"
                        >
                          {a.severity.toLowerCase()}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {timeAgo(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/prints/${a.printJobId}`}
                      className="text-sm font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                    >
                      Review
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Batch Activity
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Latest print inspections</p>
          <ul className="mt-4 space-y-3">
            {recentPrints.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">
                No print jobs yet.
              </li>
            ) : (
              recentPrints.map((p) => {
                const verdict =
                  p.status === "MATCH"
                    ? { label: "Passed", tone: "success" as const }
                    : p.status === "MISMATCH"
                      ? { label: "Hold", tone: "danger" as const }
                      : p.status === "FAILED"
                        ? { label: "Failed", tone: "warning" as const }
                        : { label: "Processing", tone: "info" as const };
                return (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/prints/${p.id}`}
                        className="text-sm font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                      >
                        PJ-{p.id.slice(-6).toUpperCase()}
                      </Link>
                      <Badge tone={verdict.tone}>{verdict.label}</Badge>
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-slate-800">
                      {p.artwork.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Post-Print · {timeAgo(p.createdAt)}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      </div>
    </MotionPage>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function ActionTile({
  icon,
  iconTone,
  title,
  desc,
  href,
  cta,
  ctaTone,
}: {
  icon: React.ReactNode;
  iconTone: "brand" | "success" | "danger";
  title: string;
  desc: string;
  href: string;
  cta: string;
  ctaTone: "brand" | "success" | "danger";
}) {
  const iconBg = {
    brand: "bg-blue-50 text-blue-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-rose-50 text-rose-600",
  }[iconTone];
  const ctaCol = {
    brand: "text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]",
    success: "text-emerald-600 hover:text-emerald-700",
    danger: "text-rose-600 hover:text-rose-700",
  }[ctaTone];
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_0_rgb(15_23_42_/_0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="mt-4 text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
      <div
        className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${ctaCol}`}
      >
        {cta}
        <ChevronRight
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
