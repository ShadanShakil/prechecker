"use client";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Maximize2,
  Download,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";

type Word = {
  id: string;
  text: string;
  language: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
  isMisspelled: boolean;
  suggestions: string[];
  overrideText: string | null;
};

type Artwork = {
  id: string;
  title: string;
  status: string;
  imageUrl: string | null;
  rejectReason: string | null;
  uploadedBy: string;
  reviewedBy: string | null;
};

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

export default function ArtworkReview({
  artwork,
  words,
  canReview,
}: {
  artwork: Artwork;
  words: Word[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const misspelled = useMemo(
    () => words.filter((w) => w.isMisspelled),
    [words],
  );
  const decided =
    artwork.status === "APPROVED" || artwork.status === "REJECTED";

  async function rerunOcr() {
    setBusy(true);
    try {
      await fetch(`/api/artwork/${artwork.id}/ocr`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    try {
      await fetch(`/api/artwork/${artwork.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "REJECTED" ? rejectReason : undefined,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestion(wordId: string, correction: string) {
    setBusy(true);
    try {
      await fetch(`/api/artwork/${artwork.id}/words/${wordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideText: correction, isMisspelled: false }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Compute overlay rectangles for misspelled words on the preview image.
  // Image is rendered with object-fit: contain at parent width — bboxes are in
  // normalized image pixels; we render relative to the image's own aspect
  // ratio using percentages.
  // We don't have the natural image size on the server; fallback: position
  // overlays using the bbox values as percentages (assumes coords are stored
  // relative to the normalized image which is rendered to fit the panel).
  const extractionPct = words.length
    ? Math.round(
        words.reduce((s, w) => s + w.confidence, 0) / words.length,
      )
    : 0;

  return (
    <MotionPage>
      <PageHeader
        title="Pre-Print Validation"
        subtitle={`Step 1 of 2 — ${artwork.title}`}
        actions={
          <Badge tone={STATUS_TONE[artwork.status] ?? "neutral"} withDot>
            {STATUS_LABEL[artwork.status] ?? artwork.status}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr_360px]">
        {/* LEFT — Upload context */}
        <Card className="p-5">
          <div className="text-base font-semibold text-slate-900">
            {artwork.title}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Uploaded by {artwork.uploadedBy}
          </p>
          {artwork.reviewedBy && (
            <p className="mt-1 text-xs text-slate-500">
              Reviewed by {artwork.reviewedBy}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="text-xl font-semibold tabular-nums text-slate-900">
                {words.length}
              </div>
              <div className="text-xs text-slate-500">Words</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div
                className={`text-xl font-semibold tabular-nums ${
                  misspelled.length > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {misspelled.length}
              </div>
              <div className="text-xs text-slate-500">Issues</div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={rerunOcr}
            disabled={busy}
            iconLeft={
              busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )
            }
            className="mt-4 w-full"
          >
            Re-run OCR
          </Button>

          <div className="mt-4">
            <Callout title="What happens next?" tone="brand">
              AI will extract all text and check for spelling errors in
              English and Arabic. Apply suggested fixes inline before
              approving.
            </Callout>
          </div>

          {artwork.rejectReason && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <div className="font-semibold">Rejection reason</div>
              <div className="mt-1 whitespace-pre-wrap">
                {artwork.rejectReason}
              </div>
            </div>
          )}
        </Card>

        {/* CENTER — Artwork preview */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Artwork Preview
              </h2>
              {misspelled.length > 0 ? (
                <Badge tone="warning" withDot>
                  {misspelled.length} issue
                  {misspelled.length === 1 ? "" : "s"} found
                </Badge>
              ) : (
                words.length > 0 && (
                  <Badge tone="success" withDot>
                    No issues
                  </Badge>
                )
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100 disabled:opacity-60"
                title="Coming soon"
              >
                <Maximize2 size={14} />
                Zoom
              </button>
              {artwork.imageUrl && (
                <a
                  href={artwork.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100"
                >
                  <Download size={14} />
                  Export
                </a>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100/40">
              {artwork.imageUrl ? (
                <ArtworkImageWithOverlay
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  misspelled={misspelled}
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-slate-500">
                  No preview available.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <div className="flex items-center gap-5 text-sm">
              <div>
                <div className="text-xs text-slate-500">Text Extraction</div>
                <div className="font-semibold tabular-nums text-emerald-600">
                  {extractionPct}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {misspelled.length} text issue
                  {misspelled.length === 1 ? "" : "s"}
                </div>
                <div
                  className={`font-semibold tabular-nums ${
                    misspelled.length > 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {misspelled.length > 0 ? "Review needed" : "All clear"}
                </div>
              </div>
            </div>

            {canReview && !decided && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReject((v) => !v)}
                >
                  Request Revision
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowReject((v) => !v)}
                  iconLeft={<XCircle size={16} />}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  onClick={() => decide("APPROVED")}
                  disabled={busy}
                  iconLeft={<CheckCircle2 size={16} />}
                >
                  Approve
                </Button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showReject && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="space-y-2 p-5">
                  <label className="block text-sm font-medium text-slate-800">
                    Reason for rejection or revision
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Describe what needs to change…"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowReject(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy || !rejectReason.trim()}
                      onClick={() => decide("REJECTED")}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* RIGHT — Issues list */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Text Issues Found
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {misspelled.length} error{misspelled.length === 1 ? "" : "s"}{" "}
            detected
          </p>

          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {misspelled.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl border border-rose-100 bg-rose-50/50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertOctagon size={14} className="text-rose-600" />
                      <span className="text-sm font-semibold text-rose-700">
                        Text Error
                      </span>
                    </div>
                    <Badge tone="neutral" className="font-mono">
                      {w.language.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-slate-600">Incorrect:</span>{" "}
                    <span
                      className="font-medium text-rose-700"
                      dir={w.language === "ar" ? "rtl" : "ltr"}
                    >
                      {w.overrideText ?? w.text}
                    </span>
                  </div>
                  {w.suggestions.length > 0 && (
                    <div className="mt-1 text-sm">
                      <span className="text-slate-600">Suggested:</span>{" "}
                      <span
                        className="font-medium text-emerald-700"
                        dir={w.language === "ar" ? "rtl" : "ltr"}
                      >
                        {w.suggestions[0]}
                      </span>
                      {w.suggestions.length > 1 && (
                        <span className="text-xs text-slate-500">
                          {" "}+ {w.suggestions.length - 1} more
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-rose-100 pt-2">
                    <span className="text-xs text-slate-500">
                      Confidence:{" "}
                      <span className="font-medium tabular-nums text-slate-700">
                        {Math.round(w.confidence)}%
                      </span>
                    </span>
                    {w.suggestions.length > 0 && canReview && !decided && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          acceptSuggestion(w.id, w.suggestions[0])
                        }
                        className="text-xs font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] disabled:opacity-60"
                      >
                        Apply Fix →
                      </button>
                    )}
                  </div>
                  {w.suggestions.length > 1 && canReview && !decided && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.suggestions.slice(1).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => acceptSuggestion(w.id, s)}
                          className="rounded bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
                          dir={w.language === "ar" ? "rtl" : "ltr"}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {misspelled.length === 0 && words.length > 0 && (
              <Callout title="What happens next?" tone="success">
                No spelling issues detected. Approve the artwork to proceed to
                print production, or request a revision if needed.
              </Callout>
            )}
            {misspelled.length === 0 && words.length === 0 && (
              <Callout tone="info">
                OCR is still processing or returned no readable text yet. You
                can re-run OCR from the left panel.
              </Callout>
            )}
          </div>
        </Card>
      </div>
    </MotionPage>
  );
}

function ArtworkImageWithOverlay({
  src,
  alt,
  misspelled,
}: {
  src: string;
  alt: string;
  misspelled: Word[];
}) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block max-h-[640px] w-full object-contain"
      />
      {/* Overlay layer — bbox values are in normalized image pixels.
          We position the overlay container absolutely over the image and
          rely on the image's natural aspect to size the overlays via
          relative percentages (we use the bbox as proportional to the
          rendered image size; see comment below for caveat). */}
      <div className="pointer-events-none absolute inset-0 hidden">
        {misspelled.map((w) => (
          <div
            key={w.id}
            className="absolute rounded ring-2 ring-rose-500"
            style={{
              left: `${w.bbox.x}px`,
              top: `${w.bbox.y}px`,
              width: `${w.bbox.w}px`,
              height: `${w.bbox.h}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
