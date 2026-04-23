import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { toPublicUrl } from "@/lib/storage";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Print vs. {job.artwork.title}
        </h1>
        <p className="text-sm text-slate-500">
          Uploaded by {job.uploadedBy?.name ?? job.uploadedBy?.email} ·{" "}
          <b>{job.status}</b>
          {job.diffScore != null && (
            <> · diff {(job.diffScore * 100).toFixed(2)}%</>
          )}
          {job.defectCount != null && <> · {job.defectCount} defect regions</>}
          {job.alignmentMethod && (
            <>
              {" "}· alignment:{" "}
              <span className="font-mono text-xs">
                {job.alignmentMethod}
                {job.goodMatches != null && ` (${job.goodMatches} matches)`}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ImgPanel title="Approved artwork" url={artworkUrl} />
        <ImgPanel
          title="Printed carton (aligned)"
          url={alignedUrl ?? originalUrl}
        />
        <ImgPanel title="Defect overlay" url={diffUrl} />
      </div>

      {report && report.regions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">
            Defect regions ({report.regions.length})
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sorted by bounding-box size. Colour on the overlay:{" "}
            <span className="text-red-600">red = large</span>,{" "}
            <span className="text-orange-600">orange = medium</span>,{" "}
            <span className="text-yellow-600">yellow = small</span>.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-4">#</th>
                  <th className="py-1 pr-4">Position (x, y)</th>
                  <th className="py-1 pr-4">Size (w × h)</th>
                  <th className="py-1 pr-4">Severity</th>
                  <th className="py-1 pr-4">Kind</th>
                </tr>
              </thead>
              <tbody>
                {report.regions.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-4 font-mono">{i + 1}</td>
                    <td className="py-1 pr-4 font-mono">
                      {r.x}, {r.y}
                    </td>
                    <td className="py-1 pr-4 font-mono">
                      {r.w} × {r.h}
                    </td>
                    <td className="py-1 pr-4 font-mono">
                      {(r.severity * 100).toFixed(0)}%
                    </td>
                    <td className="py-1 pr-4 uppercase">{r.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.regions.length > 20 && (
              <p className="mt-2 text-xs text-slate-400">
                … {report.regions.length - 20} more regions, see the overlay.
              </p>
            )}
          </div>
        </div>
      )}

      {job.alerts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-800">Alerts</div>
          <ul className="mt-2 space-y-1 text-sm text-red-900">
            {job.alerts.map((a) => (
              <li key={a.id}>
                [{a.severity}] {a.message}
                {a.acknowledgedAt ? (
                  <>
                    {" "}— acked by{" "}
                    {a.acknowledgedBy?.name ?? a.acknowledgedBy?.email} on{" "}
                    {a.acknowledgedAt.toISOString().slice(0, 10)}
                  </>
                ) : (
                  <>
                    {" "}
                    <Link href="/alerts" className="underline">
                      review
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImgPanel({ title, url }: { title: string; url: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase text-slate-500">{title}</div>
      <div className="mt-2 flex h-64 items-center justify-center bg-slate-50">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-full max-w-full" />
        ) : (
          <span className="text-xs text-slate-400">not available</span>
        )}
      </div>
    </div>
  );
}
