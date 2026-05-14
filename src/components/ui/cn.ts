/** Tiny className joiner — avoids the clsx dependency for our small surface. */
export function cn(
  ...args: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === "string") {
      out.push(a);
    } else if (typeof a === "object") {
      for (const [k, v] of Object.entries(a)) {
        if (v) out.push(k);
      }
    }
  }
  return out.join(" ");
}
