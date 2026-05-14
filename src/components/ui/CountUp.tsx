"use client";
import { useEffect, useRef, useState } from "react";

export function CountUp({
  value,
  duration = 900,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const [v, setV] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const step = (t: number) => {
      if (startedAt.current === null) startedAt.current = t;
      const p = Math.min(1, (t - startedAt.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}
