import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toPublicUrl } from "@/lib/storage";
import { CAN_REVIEW_ARTWORK, hasRole } from "@/lib/roles";
import ArtworkReview from "./review-client";

export default async function ArtworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      words: { orderBy: [{ bboxY: "asc" }, { bboxX: "asc" }] },
    },
  });
  if (!artwork) notFound();

  const canReview = hasRole(session?.user.role, CAN_REVIEW_ARTWORK);
  const imageUrl = artwork.normalizedPath
    ? toPublicUrl(artwork.normalizedPath)
    : artwork.originalPath
      ? toPublicUrl(artwork.originalPath)
      : null;

  const words = artwork.words.map((w) => ({
    id: w.id,
    text: w.text,
    language: w.language,
    bbox: { x: w.bboxX, y: w.bboxY, w: w.bboxW, h: w.bboxH },
    confidence: w.confidence,
    isMisspelled: w.isMisspelled,
    isAnnotation: w.isAnnotation,
    isOutsidePrintable: w.isOutsidePrintable,
    suggestions: w.suggestions ? (JSON.parse(w.suggestions) as string[]) : [],
    overrideText: w.overrideText,
  }));

  return (
    <ArtworkReview
      artwork={{
        id: artwork.id,
        title: artwork.title,
        status: artwork.status,
        imageUrl,
        rejectReason: artwork.rejectReason,
        uploadedBy: artwork.uploadedBy?.name ?? artwork.uploadedBy?.email ?? "",
        reviewedBy: artwork.reviewedBy?.name ?? artwork.reviewedBy?.email ?? null,
      }}
      words={words}
      canReview={canReview}
    />
  );
}
