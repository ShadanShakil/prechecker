import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_PRINT, hasRole } from "@/lib/roles";
import UploadPrintClient from "./upload-client";

export default async function NewPrintPage() {
  const session = await auth();
  if (!hasRole(session?.user.role, CAN_UPLOAD_PRINT)) {
    return <p className="text-sm text-red-600">You don&apos;t have permission to upload prints.</p>;
  }
  const artworks = await prisma.artwork.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
    take: 200,
  });
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Upload printed carton</h1>
      <p className="text-sm text-slate-500">
        Pick the approved artwork this print belongs to. We&apos;ll align the photo to the
        approved reference and flag any significant mismatch.
      </p>
      <UploadPrintClient artworks={artworks} />
    </div>
  );
}
