"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function AckButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      Acknowledge
    </button>
  );
}
