import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toPublicUrl } from "@/lib/storage";

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
      alerts: { include: { acknowledgedBy: { select: { name: true, email: true } } } },
    },
  });
  if (!job) notFound();

  const originalUrl = toPublicUrl(job.originalPath);
  const alignedUrl = job.alignedPath ? toPublicUrl(job.alignedPath) : null;
  const diffUrl = job.diffPath ? toPublicUrl(job.diffPath) : null;
  const artworkUrl = job.artwork.normalizedPath ? toPublicUrl(job.artwork.normalizedPath) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Print vs. {job.artwork.title}</h1>
        <p className="text-sm text-slate-500">
          Uploaded by {job.uploadedBy?.name ?? job.uploadedBy?.email} ·{" "}
          <b>{job.status}</b>
          {job.diffScore != null && <> · diff {(job.diffScore * 100).toFixed(2)}%</>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ImgPanel title="Approved artwork" url={artworkUrl} />
        <ImgPanel title="Printed carton (aligned)" url={alignedUrl ?? originalUrl} />
        <ImgPanel title="Difference overlay" url={diffUrl} />
      </div>

      {job.alerts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="font-medium text-red-800">Alerts</div>
          <ul className="mt-2 space-y-1 text-sm text-red-900">
            {job.alerts.map((a) => (
              <li key={a.id}>
                [{a.severity}] {a.message}
                {a.acknowledgedAt ? (
                  <>
                    {" "}— acked by {a.acknowledgedBy?.name ?? a.acknowledgedBy?.email} on{" "}
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
