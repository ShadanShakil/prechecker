"use client";
import { motion } from "framer-motion";
import { cn } from "./cn";

type Tone = "brand" | "success" | "warning" | "danger" | "purple" | "slate";

const toneStyles: Record<Tone, string> = {
  brand: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  purple: "bg-violet-500",
  slate: "bg-slate-500",
};

export function ProgressBar({
  label,
  value,
  max = 100,
  suffix,
  tone = "brand",
  delay = 0,
}: {
  label: string;
  value: number;
  max?: number;
  suffix?: string;
  tone?: Tone;
  delay?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
          className={cn("h-full rounded-full", toneStyles[tone])}
        />
      </div>
    </div>
  );
}
