"use client";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "./cn";

type Step = {
  n: number;
  label: string;
  hint?: string;
  href?: string;
  state?: "active" | "done" | "todo";
};

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      {steps.map((s, i) => {
        const active = s.state === "active";
        const done = s.state === "done";
        const wrap = cn(
          "flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition-all",
          active
            ? "border-blue-200 bg-blue-50/70"
            : done
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-slate-200 bg-white hover:border-slate-300",
        );
        const dot = cn(
          "flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold",
          active
            ? "bg-[var(--color-brand-600)] text-white"
            : done
              ? "bg-emerald-500 text-white"
              : "bg-slate-200 text-slate-700",
        );
        const inner = (
          <motion.div
            whileHover={s.href ? { y: -1 } : undefined}
            className={wrap}
          >
            <span className={dot}>{s.n}</span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Step {s.n}
              </div>
              <div className="truncate text-sm font-semibold text-slate-900">
                {s.label}
              </div>
            </div>
          </motion.div>
        );
        return (
          <div key={s.n} className="flex items-center gap-2">
            {s.href ? (
              <Link href={s.href} className="flex-1">
                {inner}
              </Link>
            ) : (
              inner
            )}
            {i < steps.length - 1 && (
              <ChevronRight
                className="hidden flex-none text-slate-400 sm:block"
                size={18}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
