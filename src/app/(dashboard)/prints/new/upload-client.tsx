"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileImage,
  Loader2,
  AlertCircle,
  ScanLine,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";

type Option = { id: string; title: string };

export default function UploadPrintClient({ artworks }: { artworks: Option[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [artworkId, setArtworkId] = useState<string>(artworks[0]?.id ?? "");
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
    if (!file || !artworkId) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("artworkId", artworkId);
      const res = await fetch("/api/prints", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const { print } = await res.json();
      await fetch(`/api/prints/${print.id}/analyze`, { method: "POST" });
      router.push(`/prints/${print.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  if (artworks.length === 0) {
    return (
      <Callout title="No approved artwork yet" tone="info">
        Ask a reviewer to approve an artwork first. Approved artwork is the
        reference image we align printed cartons against.
      </Callout>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <form onSubmit={submit}>
        <Card className="p-6">
          <label className="block">
            <span className="block text-sm font-medium text-slate-800">
              Approved artwork
            </span>
            <select
              value={artworkId}
              onChange={(e) => setArtworkId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30 focus:outline-none"
            >
              {artworks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>

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
            className={`group mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-50/60"
                : file
                  ? "border-emerald-300 bg-emerald-50/50"
                  : "border-slate-300 bg-slate-50/60 hover:border-emerald-500 hover:bg-emerald-50/40"
            }`}
          >
            <motion.div
              animate={{
                y: dragOver ? -4 : 0,
                scale: dragOver ? 1.05 : 1,
              }}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                file
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-white text-emerald-600 shadow-sm"
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
                  Drop printed-carton photo here
                </div>
                <div className="text-xs text-slate-500">
                  PNG, JPG, WebP — top-down photo works best
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

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={16} className="mt-0.5 flex-none" />
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="submit"
              variant="success"
              disabled={loading || !file || !artworkId}
              iconLeft={
                loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ScanLine size={16} />
                )
              }
            >
              {loading ? "Uploading & analyzing…" : "Upload & analyze"}
            </Button>
          </div>
        </Card>
      </form>

      <div className="space-y-4">
        <Callout title="What happens next?" tone="brand">
          The printed carton is aligned to the approved artwork using ORB
          feature matching + homography. Per-pixel differences are clustered
          into defect regions and surfaced as alerts.
        </Callout>
        <Callout tone="info">
          Take a flat, well-lit, top-down photo. The more visible the carton
          face, the better the alignment.
        </Callout>
      </div>
    </div>
  );
}
