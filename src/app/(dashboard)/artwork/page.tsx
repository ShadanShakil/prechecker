import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_ARTWORK, hasRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";
import { Callout } from "@/components/ui/Callout";

const STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "success" | "danger" | "info"
> = {
  PENDING_OCR: "info",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_OCR: "Processing OCR",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
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
    <MotionPage>
      <PageHeader
        title="Pre-Print Validation"
        subtitle="Upload, OCR, and review artwork in English and Arabic before it heads to print production."
        actions={
          canUpload && (
            <Link href="/artwork/new">
              <Button iconLeft={<Plus size={16} />}>New Artwork</Button>
            </Link>
          )
        }
      />

      <Callout title="What happens next?" tone="brand">
        Each upload runs through dual-engine OCR (Tesseract + PaddleOCR) and is
        spell-checked against English and Arabic dictionaries. Reviewers can
        accept suggestions inline, then approve or reject the artwork for
        production.
      </Callout>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">
            Artwork batches
          </h2>
          <span className="text-xs text-slate-500">
            {artworks.length} record{artworks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Words</th>
                <th className="px-5 py-3 text-left">Prints</th>
                <th className="px-5 py-3 text-left">Uploaded</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {artworks.map((a) => (
                <tr
                  key={a.id}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {a.title}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      tone={STATUS_TONE[a.status] ?? "neutral"}
                      withDot
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700">
                    {a._count.words}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700">
                    {a._count.prints}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    <div className="text-slate-700">
                      {a.uploadedBy?.name ?? a.uploadedBy?.email}
                    </div>
                    <div className="text-xs">
                      {a.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/artwork/${a.id}`}
                      className="text-sm font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {artworks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Upload size={20} />
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-900">
                      No artwork yet
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Upload your first artwork to begin pre-print validation.
                    </p>
                    {canUpload && (
                      <Link href="/artwork/new" className="mt-4 inline-block">
                        <Button iconLeft={<Plus size={16} />}>
                          New Artwork
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
