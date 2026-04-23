"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AckButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
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
      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
    >
      Acknowledge
    </button>
  );
}
