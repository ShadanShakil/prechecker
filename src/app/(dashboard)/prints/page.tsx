import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_PRINT, hasRole } from "@/lib/roles";

const STATUS_STYLES: Record<string, string> = {
  PROCESSING: "bg-slate-200 text-slate-700",
  MATCH: "bg-emerald-100 text-emerald-800",
  MISMATCH: "bg-red-100 text-red-800",
  FAILED: "bg-amber-100 text-amber-800",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Print jobs</h1>
        {canUpload && (
          <Link
            href="/prints/new"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Upload printed carton
          </Link>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Artwork</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Diff score</th>
              <th className="px-4 py-2 text-left">Uploaded</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prints.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{p.artwork.title}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "bg-slate-100"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {p.diffScore != null ? `${(p.diffScore * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {p.uploadedBy?.name ?? p.uploadedBy?.email} · {p.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/prints/${p.id}`} className="text-slate-900 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {prints.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No prints yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
