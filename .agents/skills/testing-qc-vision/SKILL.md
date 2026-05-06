# Testing QC Vision app

Apply when: user asks to test, smoke, or verify the QC Vision (carton-qc) Next.js app locally.

## Setup

```bash
pnpm install
cp .env.example .env       # AUTH_SECRET defaults work for local
pnpm prisma migrate deploy
pnpm db:seed               # creates the 4 seeded users below
pnpm build && pnpm start   # production build, port 3000
```

If you see `Cannot find module 'tesseract.js/src/worker-script/node/index.js'` on Windows, `next.config.ts` is missing `serverExternalPackages` (PR #1 ZIPs lacked the fix; PR #2+ has it).

## Seeded credentials (all password `password`)

| Role | Email | Can do |
|---|---|---|
| ADMIN | `admin@carton.local` | everything (use this for full-flow tests) |
| REVIEWER | `reviewer@carton.local` | upload artwork, approve/reject |
| QC_INSPECTOR | `qc@carton.local` | upload prints, ack alerts (CANNOT upload artwork) |
| OPERATOR | `operator@carton.local` | upload artwork only |

## Routes (per redesign)

- `/login` — dark gradient + centered card
- `/dashboard` — KPI cards, 3-step pipeline, action tiles, snapshots, alerts feed
- `/artwork` and `/artwork/[id]` — Pre-Print Validation 3-column detail
- `/prints` and `/prints/[id]` — Post-Print Inspection (Side-by-side / Defect overlay tabs)
- `/alerts` — Quality Alerts table (Acknowledge action only available on Open rows)
- `/reports` — Recharts AreaChart (Quality Health) + LineChart (Approvals/Issues)
- `/users` — admin-only directory (sidebar-hidden + page-level redirect for non-admin)
- `/settings` — stub showing user role

## Things to assert (high signal)

- **Pre-Print confidence**: `Text Extraction` and per-word `Confidence` must be ≤ 100%. If they show `9589%` / `9924%` the `* 100` regression is back (review-client.tsx lines ~130 and ~433).
- **Sidebar active pill**: only one item highlighted at any time; pill animates between routes via Framer Motion `layoutId="qc-sidebar-active"`.
- **Acknowledge mutation**: clicking `Acknowledge` on an Open alert must flip the row to `Acknowledged by <Name>`, decrement `Open Alerts`, increment `Acknowledged`, and remove the button.
- **Role gating**: as a non-admin (e.g. `qc@carton.local`), `User Management` must NOT appear in the sidebar AND direct nav to `/users` must redirect to `/dashboard`.
- **Defect overlay**: the diff PNG already has colored rectangles drawn server-side by the homography pipeline — don't expect HTML `ring-2` divs over the image.
- **Reports KPIs** are deterministic from seeded data: `33.3%` health, `10` approvals, `2` mismatches; pipeline summary `11 / 3 / 1 / 2`.

## Recording / annotations

`computer(action="record_start")` may reject with "Recording actions are now separate top-level tools". If so, the top-level `recording_start` / `recording_stop` / `annotate_recording` tools may also be unavailable in the function list — fall back to high-quality screenshots per assertion. Don't waste cycles searching for a recording tool that isn't there.

## Adversarial Stage 2 test (from PR #2)

If you need to *prove* homography alignment is real (not a fixed-resize fallback), use `scripts/adversarial-print.mjs` (or the recipe in PR #2's report): rotate the artwork ~3° and inject a known 80×80 colored square. A real homography pipeline returns `MATCH · diff < 1% · homography (XXX matches) · 1 region at the injected coords`. A resize-only pipeline would score 30%+ diff with dozens of spurious regions.

## Devin secrets needed

None for the local app — all credentials are seeded and stored in `.env`. SMTP (`SMTP_HOST/SMTP_PASS/...`) is optional and only needed if testing email alerts; leave blank to disable.
