import Link from "next/link";
import {
  AlertTriangle,
  AlertOctagon,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_ACK_ALERTS, hasRole } from "@/lib/roles";
import AckButton from "./ack-client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MotionPage,
  MotionStagger,
  MotionItem,
} from "@/components/ui/MotionPage";
import { StatCard } from "@/components/ui/StatCard";

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AlertsPage() {
  const session = await auth();
  const [alerts, openCount, highCount, mediumCount, lowCount, ackCount] =
    await Promise.all([
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          printJob: {
            include: { artwork: { select: { id: true, title: true } } },
          },
          acknowledgedBy: { select: { name: true, email: true } },
        },
        take: 200,
      }),
      prisma.alert.count({ where: { acknowledgedAt: null } }),
      prisma.alert.count({
        where: { acknowledgedAt: null, severity: "HIGH" },
      }),
      prisma.alert.count({
        where: { acknowledgedAt: null, severity: "MEDIUM" },
      }),
      prisma.alert.count({
        where: { acknowledgedAt: null, severity: "LOW" },
      }),
      prisma.alert.count({ where: { acknowledgedAt: { not: null } } }),
    ]);
  const canAck = hasRole(session?.user.role, CAN_ACK_ALERTS);

  return (
    <MotionPage>
      <PageHeader
        title="Quality Alerts"
        subtitle="Real-time list of detected issues across all printed cartons."
      />

      <MotionStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MotionItem>
          <StatCard
            value={openCount}
            label="Open Alerts"
            hint="Awaiting acknowledgment"
            icon={<Bell size={18} />}
            iconTone="brand"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={highCount}
            label="Critical"
            hint="Severity HIGH"
            icon={<AlertOctagon size={18} />}
            iconTone="danger"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={mediumCount + lowCount}
            label="Major + Minor"
            hint={`${mediumCount} medium · ${lowCount} low`}
            icon={<AlertTriangle size={18} />}
            iconTone="warning"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={ackCount}
            label="Acknowledged"
            hint="Resolved by inspectors"
            icon={<CheckCircle2 size={18} />}
            iconTone="success"
          />
        </MotionItem>
      </MotionStagger>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            All Alerts
          </h2>
          <span className="text-xs text-slate-500">
            {alerts.length} record{alerts.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Severity</th>
                <th className="px-5 py-3 text-left">Message</th>
                <th className="px-5 py-3 text-left">Print Job</th>
                <th className="px-5 py-3 text-left">When</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((a) => {
                const tone =
                  a.severity === "HIGH"
                    ? "danger"
                    : a.severity === "MEDIUM"
                      ? "warning"
                      : "info";
                const sevLabel =
                  a.severity === "HIGH"
                    ? "Critical"
                    : a.severity === "MEDIUM"
                      ? "Major"
                      : "Minor";
                return (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3">
                      <Badge tone={tone} withDot>
                        {sevLabel}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-800">{a.message}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/prints/${a.printJob.id}`}
                        className="text-sm font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                      >
                        {a.printJob.artwork.title}
                      </Link>
                      <div className="font-mono text-xs text-slate-500">
                        PJ-{a.printJob.id.slice(-6).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <div>{timeAgo(a.createdAt)}</div>
                      <div className="text-xs">
                        {a.createdAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {a.acknowledgedAt ? (
                        <Badge tone="success" withDot>
                          Acknowledged
                        </Badge>
                      ) : (
                        <Badge tone="warning" withDot>
                          Open
                        </Badge>
                      )}
                      {a.acknowledgedAt && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          by{" "}
                          {a.acknowledgedBy?.name ??
                            a.acknowledgedBy?.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!a.acknowledgedAt && canAck && (
                        <AckButton id={a.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-900">
                      No alerts
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      All printed cartons match their approved artwork.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </MotionPage>
  );
}
