"use client";
import { motion } from "framer-motion";
import { cn } from "./cn";

type Tone = "brand" | "success" | "warning" | "danger" | "purple" | "neutral";

const toneIcon: Record<Tone, string> = {
  brand: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  purple: "bg-violet-50 text-violet-600",
  neutral: "bg-slate-100 text-slate-600",
};

const toneDot: Record<Tone, string> = {
  brand: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  purple: "bg-violet-500",
  neutral: "bg-slate-500",
};

export function StatCard({
  icon,
  iconTone = "brand",
  value,
  label,
  hint,
  dot = false,
  delay = 0,
}: {
  icon?: React.ReactNode;
  iconTone?: Tone;
  value: string | number;
  label: string;
  hint?: string;
  dot?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_0_rgb(15_23_42_/_0.04),0_4px_12px_-2px_rgb(15_23_42_/_0.05)]"
    >
      <div className="flex items-start justify-between gap-3">
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              toneIcon[iconTone],
            )}
          >
            {icon}
          </div>
        )}
        {dot && (
          <span className={cn("mt-2 h-2 w-2 rounded-full", toneDot[iconTone])} />
        )}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </motion.div>
  );
}
