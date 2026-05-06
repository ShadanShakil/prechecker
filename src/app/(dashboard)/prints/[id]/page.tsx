import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { toPublicUrl } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";
import InspectionClient from "./inspection-client";

type Report = {
  width: number;
  height: number;
  diffScore: number;
  regions: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    severity: number;
    kind: "small" | "medium" | "large";
  }>;
};

async function loadReport(reportPath: string | null): Promise<Report | null> {
  if (!reportPath) return null;
  try {
    const raw = await fs.readFile(reportPath, "utf8");
    return JSON.parse(raw) as Report;
  } catch {
    return null;
  }
}

const STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "success" | "danger" | "info"
> = {
  PROCESSING: "info",
  MATCH: "success",
  MISMATCH: "danger",
  ALIGNMENT_UNCERTAIN: "warning",
  FAILED: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Analyzing",
  MATCH: "Match",
  MISMATCH: "Mismatch",
  ALIGNMENT_UNCERTAIN: "Re-photograph needed",
  FAILED: "Failed",
};

export default async function PrintDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.printJob.findUnique({
    where: { id },
    include: {
      artwork: true,
      uploadedBy: { select: { name: true, email: true } },
      alerts: {
        include: { acknowledgedBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!job) notFound();

  const originalUrl = toPublicUrl(job.originalPath);
  const alignedUrl = job.alignedPath ? toPublicUrl(job.alignedPath) : null;
  const diffUrl = job.diffPath ? toPublicUrl(job.diffPath) : null;
  const artworkUrl = job.artwork.normalizedPath
    ? toPublicUrl(job.artwork.normalizedPath)
    : null;
  const report = await loadReport(job.reportJsonPath);

  return (
    <MotionPage>
      <PageHeader
        title="Post-Print Inspection"
        subtitle={`Step 2 of 2 — ${job.artwork.title}`}
        actions={
          <Badge tone={STATUS_TONE[job.status] ?? "neutral"} withDot>
            {STATUS_LABEL[job.status] ?? job.status}
          </Badge>
        }
      />

      {job.statusReason && (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm ${
            job.status === "ALIGNMENT_UNCERTAIN"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : job.status === "MISMATCH"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {job.statusReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <InspectionClient
          artworkUrl={artworkUrl}
          alignedUrl={alignedUrl ?? originalUrl}
          diffUrl={diffUrl}
          regions={report?.regions ?? []}
          imageWidth={report?.width ?? 1}
          imageHeight={report?.height ?? 1}
          status={job.status}
          diffScore={job.diffScore}
        />

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Inspection summary
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <Row label="Job ID">
                <span className="font-mono text-xs">
                  PJ-{job.id.slice(-8).toUpperCase()}
                </span>
              </Row>
              <Row label="Artwork">{job.artwork.title}</Row>
              <Row label="Uploaded by">
                {job.uploadedBy?.name ?? job.uploadedBy?.email}
              </Row>
              <Row label="Diff (printable)">
                {job.maskedDiffScore != null
                  ? `${(job.maskedDiffScore * 100).toFixed(2)}%`
                  : job.diffScore != null
                    ? `${(job.diffScore * 100).toFixed(2)}%`
                    : "—"}
              </Row>
              {job.globalDiffScore != null && (
                <Row label="Diff (full frame)">
                  <span className="text-slate-500">
                    {`${(job.globalDiffScore * 100).toFixed(2)}%`}
                  </span>
                </Row>
              )}
              <Row label="Defect regions">
                {job.defectCount ?? report?.regions.length ?? "—"}
              </Row>
              <Row label="Alignment">
                <span className="font-mono text-xs">
                  {job.alignmentMethod ?? "—"}
                  {job.goodMatches != null && ` (${job.goodMatches} matches)`}
                </span>
              </Row>
              {job.alignmentConfidence != null && (
                <Row label="Alignment confidence">
                  <span
                    className={
                      job.alignmentConfidence >= 0.7
                        ? "font-semibold text-emerald-600"
                        : job.alignmentConfidence >= 0.35
                          ? "font-semibold text-amber-600"
                          : "font-semibold text-red-600"
                    }
                  >
                    {`${Math.round(job.alignmentConfidence * 100)}%`}
                  </span>
                </Row>
              )}
              <Row label="Created">
                {job.createdAt.toISOString().slice(0, 19).replace("T", " ")}
              </Row>
            </dl>
          </Card>

          {job.alerts.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Linked alerts
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {job.alerts.map((a) => {
                  const tone =
                    a.severity === "HIGH"
                      ? "danger"
                      : a.severity === "MEDIUM"
                        ? "warning"
                        : "info";
                  return (
                    <li
                      key={a.id}
                      className="rounded-lg border border-slate-100 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={tone}>{a.severity}</Badge>
                        {a.acknowledgedAt ? (
                          <span className="text-xs text-emerald-600">
                            Acknowledged
                          </span>
                        ) : (
                          <Link
                            href="/alerts"
                            className="text-xs font-medium text-[var(--color-brand-600)]"
                          >
                            Review →
                          </Link>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {a.message}
                      </div>
                      {a.acknowledgedAt && (
                        <div className="mt-1 text-xs text-slate-500">
                          By{" "}
                          {a.acknowledgedBy?.name ??
                            a.acknowledgedBy?.email}{" "}
                          on{" "}
                          {a.acknowledgedAt
                            .toISOString()
                            .slice(0, 10)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </MotionPage>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}
