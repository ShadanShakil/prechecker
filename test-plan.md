# PR #4 Test Plan — QC Vision Redesign

**PR:** https://github.com/ShadanShakil/prechecker/pull/4
**Branch:** `devin/1778074349-qc-vision-redesign` → `main`
**Scope:** Tailwind v4 + Framer Motion redesign of all 7 frames + 1 incidental confidence-display fix. No backend / OCR / homography / DB changes.

## What changed (user-visible)

1. **All pages re-skinned** — dark navy sidebar, white topbar, Inter font, Framer Motion entrance/stagger animations, Lucide icons.
2. **Two new pages:** `/reports` (Recharts trend charts) and `/users` (admin-only read-only directory).
3. **Pre-Print Validation bug fix:** `Text Extraction` and per-word `Confidence` no longer render as `9589%` / `9924%`. They now show `~96%` / `~99%`.
4. **Sidebar role gating** — `User Management` link only renders for `ADMIN`.

## Test environment

- Local prod build: `pnpm build && pnpm start` on `http://localhost:3000`.
- DB seeded with admin + reviewer + qc + operator (password = `password`) and 11 prior artworks / 10 print jobs from PR #2 testing.

---

## Tests

Each test below is designed so a broken implementation would visibly fail — no "renders fine" vibes.

### T1 — Confidence-display fix (the only behavioral change)

**Why this matters:** before this PR, Tesseract's 0–100 confidence was multiplied by 100 again, so the Pre-Print page showed wildly wrong percentages.

**Steps**
1. Login as `admin@carton.local`.
2. Click `Pre-Print Validation` in the sidebar.
3. Click `Open →` on the row titled `PR2 Test — Mango HAPPYNESS QA`.

**Pass criteria (concrete)**
- The footer of the centre `Artwork Preview` card shows `Text Extraction` ≤ `100%`. Specifically, it must read `96%` (rounded mean of stored confidences), **not** `9589%`.
- The right-side `Text Issues Found` card with text `Incorrect: HAPPYNESS` shows `Confidence: 99%`, **not** `Confidence: 9924%`.

**Why this would fail if broken:** if the `* 100` were restored, both numbers would render as 4-digit percentages. A regex-grep against the live DOM proves it.

---

### T2 — Sidebar active-state Framer Motion animation

**Why this matters:** the entire visual identity hinges on the sidebar nav. A static (non-animated) sidebar means the `layoutId="qc-sidebar-active"` motion span is broken.

**Steps**
1. From `/dashboard`, capture sidebar screenshot with `Dashboard` highlighted blue.
2. Click `Pre-Print Validation`. Capture immediately during the spring transition.
3. Click `Quality Alerts`. Capture again.

**Pass criteria**
- The blue active-pill always sits under exactly **one** nav item (no two simultaneously highlighted).
- During the second click, a single transition state is captured where the pill is animating between positions (not teleporting). Confirmed by comparing post-click screenshot timestamps.
- After all clicks, the active pill is centred under `Quality Alerts` and `pathname` matches `/alerts`.

---

### T3 — Post-Print Inspection: tab switch + defect overlay

**Why this matters:** the new design replaces the simple diff image with a tab-switching inspection view. Both the tab transition (`layoutId="qc-print-tab"`) and the overlay rendering (region rectangles drawn over the print pane) are new UI logic.

**Steps**
1. Navigate to `/prints` and open `PJ-S7UKLE` (PR2 Smoke / Mismatch / 17 defects).
2. With `Side-by-side` tab active, observe two image panes (Approved Artwork on left, Printed Carton on right with red ring frame).
3. Click `Defect overlay` tab.

**Pass criteria**
- In `Side-by-side`: bottom-left stat row reads exactly `Print Accuracy 64.2%`, `Defects 17`, `Verdict Fail / Hold`.
- After clicking `Defect overlay`: the tab indicator (light pill) is now under `Defect overlay`, and the right pane title becomes `Defect Overlay`.
- The diff image is visible in the overlay tab AND ≥1 absolutely-positioned `<div>` with a `ring-2` class is rendered on top of it (region bbox markers).
- The "Mismatch Details" grid below shows ≥12 defect cards, with at least one card whose `Severity` value is `35%` (Region #1, the largest).

---

### T4 — Quality Alerts: acknowledge mutation

**Why this matters:** this is the only mutating action exposed in the redesigned alerts page. If the Acknowledge button's wiring or the row state-flip is broken, the new design hides nothing useful.

**Steps**
1. Navigate to `/alerts`.
2. Note: the row for `PR2 Smoke / PJ-S7UKLE` (Critical) currently shows status `Open` with an `Acknowledge` button. The other Critical row already says `Acknowledged by Admin`.
3. Click the `Acknowledge` button on the open row.
4. Wait for the page to re-render.

**Pass criteria**
- After click, the same row's Status cell changes from `Open` (amber dot) to `Acknowledged` (emerald dot) with a small `by Admin` line.
- The `Acknowledge` button on that row disappears (only Open rows render the button).
- The top-of-page KPI card `Open Alerts` decrements from `1` to `0`, AND `Acknowledged` increments from `1` to `2`.

**Why this would fail if broken:** if `router.refresh()` or the API call were broken, the row would still render `Open` even after a 200 response.

---

### T5 — Quality Reports: Recharts render real data

**Why this matters:** `/reports` is a brand-new page in this PR. If `recharts` integration or the SSR data aggregation is broken, the charts will be blank or constant.

**Steps**
1. Navigate to `/reports`.
2. Inspect the two chart cards visually and via DOM.

**Pass criteria**
- The top three KPI cards read `33.3%`, `10`, `2` (Quality Health, Approvals, Mismatches) — these are deterministic from the seeded data.
- The `Quality Health %` AreaChart contains an SVG `<path>` with `stroke="#2563eb"` whose `d` attribute is non-trivial (more than just two points). Y-axis shows `0%`, `25%`, `50%`, `75%`, `100%` ticks.
- The `Approvals & Issues Over Time` LineChart has TWO `<path>` lines with strokes `#10b981` (green) and `#ef4444` (red). Legend at the bottom reads `Approvals` and `Issues`.
- Bottom `Pipeline summary` reads `Total Artwork 11`, `Print jobs analyzed 3`, `Matches 1`, `Mismatches 2`.

---

### T6 — Sidebar role gating (admin-only)

**Why this matters:** the spec exclusion for `/users` says *admin-only*. Verifying the `roles: ["ADMIN"]` filter actually hides the link is the cheapest way to prove that scoping works.

**Steps**
1. Sign out from the current admin session via the topbar `Sign Out` button.
2. Login as `qc@carton.local` / `password` (QC_INSPECTOR).
3. Inspect the sidebar.
4. Manually navigate to `/users` via URL bar.

**Pass criteria**
- Sidebar `Admin` group shows ONLY `Settings`, NOT `User Management`.
- Direct URL navigation to `/users` redirects to `/dashboard` (the page redirects non-admins per `users/page.tsx`).
- Sign-out succeeded: clicking `Sign Out` first redirected to `/login`.

---

## Out of scope (not testing this round)

- OCR / homography / dual-engine voter accuracy — already proven in PR #2 test report.
- Mobile / responsive layout — sidebar is `hidden lg:flex`, design doesn't include mobile yet.
- Animation timings as numeric values — visual smoothness is judged in the recording, not asserted.
- Dropped features (search, AI Insights, Heatmap, Export PDF, user CRUD) — agreed out of scope by user.
