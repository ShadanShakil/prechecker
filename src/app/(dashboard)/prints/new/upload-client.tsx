"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; title: string };

export default function UploadPrintClient({ artworks }: { artworks: Option[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [artworkId, setArtworkId] = useState<string>(artworks[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No approved artwork yet. Ask a reviewer to approve one first.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <label className="block text-sm">
        Approved artwork
        <select
          value={artworkId}
          onChange={(e) => setArtworkId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {artworks.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Printed carton photo
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
        disabled={loading || !file || !artworkId}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Uploading & analyzing…" : "Upload & analyze"}
      </button>
    </form>
  );
}
