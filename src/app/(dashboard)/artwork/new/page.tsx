"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewArtworkPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Upload artwork</h1>
      <p className="text-sm text-slate-500">
        Accepts PNG, JPG, or WebP. The file is OCR&apos;d immediately — English and Arabic words
        are extracted and compared against their respective dictionaries.
      </p>
      <form
        onSubmit={submit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <label className="block text-sm">
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Mango Juice 1L front panel"
          />
        </label>
        <label className="block text-sm">
          Artwork file
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Uploading & processing…" : "Upload & run OCR"}
        </button>
      </form>
    </div>
  );
}
