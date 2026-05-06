"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Columns2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Region = {
  x: number;
  y: number;
  w: number;
  h: number;
  severity: number;
  kind: "small" | "medium" | "large";
};

type Props = {
  artworkUrl: string | null;
  alignedUrl: string | null;
  diffUrl: string | null;
  regions: Region[];
  imageWidth: number;
  imageHeight: number;
  status: string;
  diffScore: number | null;
};

type Tab = "side-by-side" | "overlay";

function regionTone(kind: "small" | "medium" | "large"): {
  label: string;
  badge: "warning" | "danger" | "info";
  ring: string;
} {
  if (kind === "large")
    return {
      label: "Critical",
      badge: "danger",
      ring: "ring-rose-500",
    };
  if (kind === "medium")
    return {
      label: "Major",
      badge: "warning",
      ring: "ring-amber-500",
    };
  return { label: "Minor", badge: "info", ring: "ring-sky-500" };
}

export default function InspectionClient({
  artworkUrl,
  alignedUrl,
  diffUrl,
  regions,
  imageWidth,
  imageHeight,
  status,
  diffScore,
}: Props) {
  const [tab, setTab] = useState<Tab>("side-by-side");
  const [hovered, setHovered] = useState<number | null>(null);

  const accuracy =
    diffScore != null ? Math.max(0, 100 - diffScore * 100) : null;
  const isPass = status === "MATCH";
  const isFail = status === "MISMATCH";

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <Card>
        <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2">
          <TabButton
            active={tab === "side-by-side"}
            onClick={() => setTab("side-by-side")}
            icon={<Columns2 size={14} />}
            label="Side-by-side"
          />
          <TabButton
            active={tab === "overlay"}
            onClick={() => setTab("overlay")}
            icon={<Layers size={14} />}
            label="Defect overlay"
          />
        </div>

        <AnimatePresence mode="wait">
          {tab === "side-by-side" ? (
            <motion.div
              key="side"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2"
            >
              <ImagePane
                title="Approved Artwork"
                tag="Reference"
                url={artworkUrl}
              />
              <ImagePane
                title="Printed Carton"
                tag="Captured"
                url={alignedUrl}
                regions={regions}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                hovered={hovered}
              />
            </motion.div>
          ) : (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <ImagePane
                title="Defect Overlay"
                tag="Differences"
                url={diffUrl}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-6">
            {accuracy != null && (
              <div>
                <div className="text-xs text-slate-500">Print Accuracy</div>
                <div className="text-lg font-semibold text-emerald-600 tabular-nums">
                  {accuracy.toFixed(1)}%
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Defects</div>
              <div
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  regions.length === 0
                    ? "text-emerald-600"
                    : regions.length < 5
                      ? "text-amber-600"
                      : "text-rose-600",
                )}
              >
                {regions.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Verdict</div>
              <div className="mt-0.5">
                {isPass && (
                  <Badge tone="success" withDot>
                    Pass
                  </Badge>
                )}
                {isFail && (
                  <Badge tone="danger" withDot>
                    Fail / Hold
                  </Badge>
                )}
                {!isPass && !isFail && (
                  <Badge tone="info" withDot>
                    Processing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isPass && (
            <Button
              variant="success"
              iconLeft={<CheckCircle2 size={16} />}
              disabled
              title="Auto-approved by analysis"
            >
              Approved
            </Button>
          )}
          {isFail && (
            <Button
              variant="danger"
              iconLeft={<XCircle size={16} />}
              disabled
              title="Flagged for review"
            >
              On Hold
            </Button>
          )}
        </div>
      </Card>

      {/* Mismatches list */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Mismatch Details
          </h2>
          <span className="text-xs text-slate-500">
            {regions.length} region{regions.length === 1 ? "" : "s"} detected
          </span>
        </div>

        {regions.length === 0 ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div className="mt-2 text-sm font-semibold text-emerald-700">
              No defects detected
            </div>
            <div className="mt-0.5 text-xs text-emerald-700/80">
              The printed carton matches the approved artwork.
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {regions.slice(0, 12).map((r, i) => {
              const tone = regionTone(r.kind);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    hovered === i
                      ? "border-slate-300 bg-slate-50"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        size={14}
                        className={cn(
                          "flex-none",
                          r.kind === "large"
                            ? "text-rose-600"
                            : r.kind === "medium"
                              ? "text-amber-600"
                              : "text-sky-600",
                        )}
                      />
                      <span className="text-sm font-semibold text-slate-900">
                        Defect Region #{i + 1}
                      </span>
                    </div>
                    <Badge tone={tone.badge}>{tone.label}</Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div>
                      <dt className="text-slate-500">Position</dt>
                      <dd className="font-mono">
                        {r.x}, {r.y}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Size</dt>
                      <dd className="font-mono">
                        {r.w}×{r.h} px
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Severity</dt>
                      <dd className="font-mono tabular-nums">
                        {(r.severity * 100).toFixed(0)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Kind</dt>
                      <dd className="uppercase">{r.kind}</dd>
                    </div>
                  </dl>
                </motion.div>
              );
            })}
          </div>
        )}
        {regions.length > 12 && (
          <p className="mt-3 text-xs text-slate-500">
            Showing top 12 of {regions.length}. Use the overlay tab to view all
            regions.
          </p>
        )}
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      {active && (
        <motion.span
          layoutId="qc-print-tab"
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="absolute inset-0 rounded-md bg-slate-100"
        />
      )}
      <span className="relative z-[1] flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

function ImagePane({
  title,
  tag,
  url,
  regions,
  imageWidth,
  imageHeight,
  hovered,
}: {
  title: string;
  tag: string;
  url: string | null;
  regions?: Region[];
  imageWidth?: number;
  imageHeight?: number;
  hovered?: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100/40">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <Badge tone="neutral">{tag}</Badge>
      </div>
      <div className="relative flex min-h-[320px] items-center justify-center p-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="block max-h-[480px] w-full rounded object-contain"
          />
        ) : (
          <span className="text-xs text-slate-400">not available</span>
        )}
        {regions && regions.length > 0 && imageWidth && imageHeight && (
          <div className="pointer-events-none absolute inset-3">
            {regions.slice(0, 12).map((r, i) => {
              const tone = regionTone(r.kind);
              const isHover = hovered === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute rounded ring-2 transition-all",
                    tone.ring,
                    isHover ? "ring-[3px]" : "",
                  )}
                  style={{
                    left: `${(r.x / imageWidth) * 100}%`,
                    top: `${(r.y / imageHeight) * 100}%`,
                    width: `${(r.w / imageWidth) * 100}%`,
                    height: `${(r.h / imageHeight) * 100}%`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
