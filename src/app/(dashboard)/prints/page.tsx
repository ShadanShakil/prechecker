import Link from "next/link";
import { Plus, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_PRINT, hasRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";

const STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "success" | "danger" | "info"
> = {
  PROCESSING: "info",
  MATCH: "success",
  MISMATCH: "danger",
  FAILED: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Analyzing",
  MATCH: "Match",
  MISMATCH: "Mismatch",
  FAILED: "Failed",
};

export default async function PrintsListPage() {
  const session = await auth();
  const prints = await prisma.printJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      artwork: { select: { id: true, title: true } },
      uploadedBy: { select: { name: true, email: true } },
    },
    take: 100,
  });
  const canUpload = hasRole(session?.user.role, CAN_UPLOAD_PRINT);

  return (
    <MotionPage>
      <PageHeader
        title="Post-Print Inspection"
        subtitle="Compare printed cartons against approved artwork using homography alignment."
        actions={
          canUpload && (
            <Link href="/prints/new">
              <Button iconLeft={<Plus size={16} />}>New Inspection</Button>
            </Link>
          )
        }
      />

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">
            Print jobs
          </h2>
          <span className="text-xs text-slate-500">
            {prints.length} record{prints.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Artwork</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Diff score</th>
                <th className="px-5 py-3 text-left">Defects</th>
                <th className="px-5 py-3 text-left">Alignment</th>
                <th className="px-5 py-3 text-left">Uploaded</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prints.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">
                      {p.artwork.title}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      PJ-{p.id.slice(-6).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[p.status] ?? "neutral"} withDot>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700">
                    {p.diffScore != null
                      ? `${(p.diffScore * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700">
                    {p.defectCount ?? "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {p.alignmentMethod ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    <div className="text-slate-700">
                      {p.uploadedBy?.name ?? p.uploadedBy?.email}
                    </div>
                    <div className="text-xs">
                      {p.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/prints/${p.id}`}
                      className="text-sm font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {prints.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <ScanLine size={20} />
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-900">
                      No print jobs yet
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Upload your first printed-carton photo to begin
                      inspection.
                    </p>
                    {canUpload && (
                      <Link href="/prints/new" className="mt-4 inline-block">
                        <Button iconLeft={<Plus size={16} />}>
                          New Inspection
                        </Button>
                      </Link>
                    )}
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
