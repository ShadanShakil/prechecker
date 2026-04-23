"use client";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

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

  const misspelled = useMemo(() => words.filter((w) => w.isMisspelled), [words]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{artwork.title}</h1>
        <p className="text-sm text-slate-500">
          Uploaded by {artwork.uploadedBy} · status <b>{artwork.status}</b>
          {artwork.reviewedBy && <> · reviewed by {artwork.reviewedBy}</>}
        </p>
        {artwork.rejectReason && (
          <p className="mt-2 text-sm text-red-700">Reject reason: {artwork.rejectReason}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {artwork.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork.imageUrl} alt={artwork.title} className="mx-auto max-h-[640px]" />
          ) : (
            <p className="text-sm text-slate-500">No preview available.</p>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-slate-500">Spell check</div>
                <div className="text-lg font-semibold">
                  {misspelled.length} flagged / {words.length} words
                </div>
              </div>
              <button
                onClick={rerunOcr}
                disabled={busy}
                className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                Re-run OCR
              </button>
            </div>
            {misspelled.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No spelling issues detected. You can approve the artwork.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {misspelled.map((w) => (
                  <li key={w.id} className="rounded border border-slate-200 p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium" dir={w.language === "ar" ? "rtl" : "ltr"}>
                        {w.overrideText ?? w.text}
                      </span>
                      <span className="text-xs text-slate-500">{w.language}</span>
                    </div>
                    {w.suggestions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {w.suggestions.map((s) => (
                          <button
                            key={s}
                            disabled={busy || !canReview}
                            onClick={() => acceptSuggestion(w.id, s)}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200 disabled:opacity-50"
                            dir={w.language === "ar" ? "rtl" : "ltr"}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canReview && artwork.status !== "APPROVED" && artwork.status !== "REJECTED" && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium">Review decision</div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => decide("APPROVED")}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => setShowReject((v) => !v)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
              {showReject && (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Reason for rejection"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    disabled={busy || !rejectReason.trim()}
                    onClick={() => decide("REJECTED")}
                    className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    Confirm reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
