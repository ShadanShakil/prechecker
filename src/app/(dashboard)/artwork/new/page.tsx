"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, type DragEvent } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileImage, Loader2, AlertCircle } from "lucide-react";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";

export default function NewArtworkPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title) fd.append("title", title);
      const res = await fetch("/api/artwork", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const { artwork } = await res.json();
      // Kick off OCR immediately.
      await fetch(`/api/artwork/${artwork.id}/ocr`, { method: "POST" });
      router.push(`/artwork/${artwork.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionPage>
      <PageHeader
        title="Upload Artwork"
        subtitle="Step 1 of 2 — Pre-Print Validation"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit}>
          <Card className="p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragOver
                  ? "border-[var(--color-brand-500)] bg-blue-50/60"
                  : file
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-slate-300 bg-slate-50/60 hover:border-[var(--color-brand-500)] hover:bg-blue-50/40"
              }`}
            >
              <motion.div
                animate={{
                  y: dragOver ? -4 : 0,
                  scale: dragOver ? 1.05 : 1,
                }}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  file ? "bg-emerald-100 text-emerald-600" : "bg-white text-blue-600 shadow-sm"
                }`}
              >
                {file ? <FileImage size={26} /> : <UploadCloud size={26} />}
              </motion.div>
              {file ? (
                <>
                  <div className="text-sm font-semibold text-slate-900">
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · click to replace
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-slate-900">
                    Drop file or click to upload
                  </div>
                  <div className="text-xs text-slate-500">
                    PDF, AI, SVG, PNG, JPG
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <label className="mt-6 block">
              <span className="block text-sm font-medium text-slate-800">
                Title (optional)
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mango Juice 1L front panel"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30 focus:outline-none"
              />
            </label>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle size={16} className="mt-0.5 flex-none" />
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="submit"
                disabled={loading || !file}
                iconLeft={
                  loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <UploadCloud size={16} />
                  )
                }
              >
                {loading ? "Uploading & processing…" : "Upload & run OCR"}
              </Button>
            </div>
          </Card>
        </form>

        <div className="space-y-4">
          <Callout title="What happens next?" tone="brand">
            AI will extract all text and check for spelling errors in English
            and Arabic, then surface issues with one-click fixes for the
            reviewer.
          </Callout>
          <Callout tone="info">
            Best results come from a top-down, high-resolution photo of the
            flat artwork with no perspective distortion.
          </Callout>
        </div>
      </div>
    </MotionPage>
  );
}
