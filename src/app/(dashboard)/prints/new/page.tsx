import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_UPLOAD_PRINT, hasRole } from "@/lib/roles";
import UploadPrintClient from "./upload-client";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";
import { Card } from "@/components/ui/Card";

export default async function NewPrintPage() {
  const session = await auth();
  if (!hasRole(session?.user.role, CAN_UPLOAD_PRINT)) {
    return (
      <MotionPage>
        <PageHeader title="Post-Print Inspection" />
        <Card className="p-6">
          <p className="text-sm text-rose-600">
            You don&apos;t have permission to upload prints.
          </p>
        </Card>
      </MotionPage>
    );
  }
  const artworks = await prisma.artwork.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
    take: 200,
  });
  return (
    <MotionPage>
      <PageHeader
        title="Upload Printed Carton"
        subtitle="Step 2 of 2 — Post-Print Inspection"
      />
      <UploadPrintClient artworks={artworks} />
    </MotionPage>
  );
}
