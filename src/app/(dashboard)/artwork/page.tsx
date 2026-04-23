import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_ARTWORK, hasRole } from "@/lib/roles";

const STATUS_STYLES: Record<string, string> = {
  PENDING_OCR: "bg-slate-200 text-slate-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default async function ArtworkListPage() {
  const session = await auth();
  const artworks = await prisma.artwork.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      _count: { select: { words: true, prints: true } },
    },
    take: 100,
  });
  const canUpload = hasRole(session?.user.role, CAN_UPLOAD_ARTWORK);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artwork</h1>
        {canUpload && (
          <Link
            href="/artwork/new"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Upload artwork
          </Link>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Words</th>
              <th className="px-4 py-2 text-left">Prints</th>
              <th className="px-4 py-2 text-left">Uploaded</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {artworks.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{a.title}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? "bg-slate-100"}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2">{a._count.words}</td>
                <td className="px-4 py-2">{a._count.prints}</td>
                <td className="px-4 py-2 text-slate-500">
                  {a.uploadedBy?.name ?? a.uploadedBy?.email} · {a.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/artwork/${a.id}`} className="text-slate-900 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {artworks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No artwork yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
