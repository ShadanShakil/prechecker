import { TrendingUp, BarChart3, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MotionPage,
  MotionStagger,
  MotionItem,
} from "@/components/ui/MotionPage";
import { StatCard } from "@/components/ui/StatCard";
import {
  ApprovalsIssuesChart,
  HealthTrendChart,
  type DailyPoint,
} from "./charts-client";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ReportsPage() {
  const days = 14;
  const now = new Date();
  const since = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));

  const [approvedArtwork, prints, allArtwork] = await Promise.all([
    prisma.artwork.findMany({
      where: { status: "APPROVED", reviewedAt: { gte: since } },
      select: { reviewedAt: true },
    }),
    prisma.printJob.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, diffScore: true },
    }),
    prisma.artwork.count(),
  ]);

  // Build per-day buckets
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    buckets.set(dateKey(d), {
      date: shortDate(d),
      approvals: 0,
      issues: 0,
      health: 100,
    });
  }
  let totalMatches = 0;
  let totalAnalyzed = 0;
  for (const a of approvedArtwork) {
    if (!a.reviewedAt) continue;
    const k = dateKey(startOfDay(a.reviewedAt));
    const b = buckets.get(k);
    if (b) b.approvals += 1;
  }
  // Compute per-day match/mismatch and rolling health
  const perDay = new Map<
    string,
    { matched: number; mismatched: number; total: number }
  >();
  for (const p of prints) {
    const k = dateKey(startOfDay(p.createdAt));
    const cur = perDay.get(k) ?? { matched: 0, mismatched: 0, total: 0 };
    cur.total += 1;
    if (p.status === "MATCH") cur.matched += 1;
    if (p.status === "MISMATCH") {
      cur.mismatched += 1;
      const b = buckets.get(k);
      if (b) b.issues += 1;
    }
    perDay.set(k, cur);
    if (p.status === "MATCH") totalMatches++;
    if (p.status === "MATCH" || p.status === "MISMATCH") totalAnalyzed++;
  }
  for (const [k, v] of perDay) {
    const b = buckets.get(k);
    if (b) {
      b.health =
        v.total > 0 ? Math.round((v.matched / v.total) * 1000) / 10 : 100;
    }
  }
  const data = [...buckets.values()];

  const overallHealth =
    totalAnalyzed > 0 ? (totalMatches / totalAnalyzed) * 100 : 100;
  const totalApprovalsRange = approvedArtwork.length;
  const totalIssuesRange = data.reduce((s, d) => s + d.issues, 0);

  return (
    <MotionPage>
      <PageHeader
        title="Quality Reports"
        subtitle={`Production health over the last ${days} days`}
      />

      <MotionStagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MotionItem>
          <StatCard
            value={`${overallHealth.toFixed(1)}%`}
            label="Overall Quality Health"
            hint="Match rate across analyzed prints"
            icon={<ShieldCheck size={18} />}
            iconTone="success"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={totalApprovalsRange}
            label="Approvals"
            hint="Artwork approved in range"
            icon={<TrendingUp size={18} />}
            iconTone="brand"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={totalIssuesRange}
            label="Mismatches"
            hint="Print jobs flagged in range"
            icon={<BarChart3 size={18} />}
            iconTone="danger"
          />
        </MotionItem>
      </MotionStagger>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Quality Health %
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Daily match rate across analyzed print jobs
              </p>
            </div>
          </div>
          <div className="mt-4">
            <HealthTrendChart data={data} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Approvals & Issues Over Time
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Artwork approvals vs. flagged print mismatches
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ApprovalsIssuesChart data={data} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Pipeline summary
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Cumulative across all time
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCell label="Total Artwork" value={allArtwork} />
          <SummaryCell label="Print jobs analyzed" value={totalAnalyzed} />
          <SummaryCell label="Matches" value={totalMatches} tone="emerald" />
          <SummaryCell
            label="Mismatches"
            value={totalAnalyzed - totalMatches}
            tone="rose"
          />
        </div>
      </Card>
    </MotionPage>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "emerald"
            ? "text-emerald-600"
            : tone === "rose"
              ? "text-rose-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
