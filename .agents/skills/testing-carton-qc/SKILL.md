# Testing Carton QC (Next.js + Prisma + SQLite)

Used for end-to-end testing of `ShadanShakil/prechecker` (Stage 1 artwork OCR + spell-check; Stage 2 print-vs-artwork alignment and defect detection).

## Quick start

```bash
cd /home/ubuntu/repos/carton-qc
pnpm prisma migrate deploy
pnpm db:seed          # re-seeds users; safe to re-run
pnpm build && pnpm start   # port 3000
```

If the build or analyze hangs on first run, check that these packages are in `serverExternalPackages` in `next.config.ts` — Turbopack silently stalls their WASM otherwise:

- `tesseract.js`
- `@techstark/opencv-js`
- `@gutenye/ocr-node`, `@gutenye/ocr-common`, `@gutenye/ocr-models`
- `onnxruntime-node`

The OpenCV WASM also hangs inside the Next dev/server runtime itself — the repo works around this by spawning `src/lib/cv-worker.mjs` as a child Node process from `/api/prints/[id]/analyze`. Don't try to re-inline OpenCV into the route handler.

## Seeded accounts

All with password `password`:

| Email | Role | What it can do |
|---|---|---|
| `admin@carton.local` | ADMIN | everything (easiest for full-flow tests) |
| `reviewer@carton.local` | REVIEWER | upload artwork, approve/reject |
| `qc@carton.local` | QC_INSPECTOR | upload **prints only**, ack alerts |
| `operator@carton.local` | OPERATOR | upload artwork only |

Role matrix lives in `src/lib/roles.ts`. Important gotcha: **QC_INSPECTOR cannot upload artwork** (`CAN_UPLOAD_ARTWORK = [OPERATOR, REVIEWER, ADMIN]`). If you log in as QC and try to upload an artwork the API returns 403 and the form shows `Forbidden`. For single-session full-flow tests, use `admin@carton.local`.

No secrets are required for local testing (no SMTP, no external APIs). Optional SMTP vars in `.env.example` can stay empty.

## Driving file uploads

The `computer` tool can't interact with `<input type=file>` (native OS dialog). Use Playwright over the existing Chrome's CDP endpoint on `localhost:29229`. One-time setup:

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm init -y >/dev/null && npm i playwright-core --no-audit --no-fund
```

Then `/tmp/upload.mjs`:

```javascript
import pkg from '/tmp/pw/node_modules/playwright-core/index.js';
const { chromium } = pkg;
const browser = await chromium.connectOverCDP('http://localhost:29229');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('localhost:3000')) || ctx.pages()[0];
await page.setInputFiles(process.argv[3] || 'input[type=file]', process.argv[2]);
await browser.close();
```

Usage: navigate to the upload page with computer-tool clicks, then:
```bash
node /tmp/upload.mjs /tmp/test-images/artwork.png
```
Then click the submit button with the computer tool.

Same script pattern works to call server APIs through the logged-in session — `await page.evaluate(...)` + `fetch(url)` inside the page context carries the session cookie. Useful because the UI currently does not display the `engines: { tesseract, paddle }` counts from `POST /api/artwork/{id}/ocr` and you need to read the raw JSON to prove dual-engine ran.

## Proving Stage 2 alignment actually works (not just "it didn't crash")

A resize-only pipeline and a real homography pipeline both produce output; the way to distinguish them is an adversarial input. Generate one with `sharp` (no native deps):

```javascript
const sharp = require('sharp');
const buf = await sharp('/tmp/test-images/artwork.png')
  .rotate(3, { background: { r: 255, g: 255, b: 255 } })
  .toBuffer();
const square = await sharp({
  create: { width: 80, height: 80, channels: 4, background: { r: 220, g: 38, b: 38, alpha: 1 } },
}).png().toBuffer();
await sharp(buf).composite([{ input: square, left: 820, top: 520 }]).toFile('/tmp/test-images/print-good.png');
```

Run analyze on this print. Working pipeline: `alignment: homography (N matches)` with N ≥ 100, diff ≤ 2%, exactly one MEDIUM/small region whose bbox overlaps the injected square. Broken pipeline: `fallback-resize`, diff ≥ 10%, or dozens of tiny regions along text edges.

You can dry-run the worker without the server, which is the fastest debugging path:
```bash
node src/lib/cv-worker.mjs '{"artworkPath":"/tmp/test-images/artwork.png","printPath":"/tmp/test-images/print-good.png","alignedOutPath":"/tmp/a.png","diffOutPath":"/tmp/d.png","mismatchThreshold":0.02}'
```
It prints one JSON line with `goodMatches`, `alignmentMethod`, `regions[]`, `verdict`.

## Where to look for key output in the UI

- Stage 1: `/artwork/{id}` — shows `X flagged / Y words`, per-word suggestions, Approve / Reject buttons.
- Stage 2: `/prints/{id}` — header has `MATCH/MISMATCH · diff X% · N defect regions · alignment: homography (M matches)`; three image panels (artwork / aligned / overlay); regions table with first 20 rows sorted by size.
- Alerts: `/alerts` — admin can ack.

DB fields added by PR #2 (`PrintJob`): `defectCount`, `alignmentMethod`, `goodMatches`. Migration `prisma/migrations/...add_printjob_defect_fields` must be applied before first run on an existing DB.

## CI

Repo has no GitHub Actions. The only check that appears on PRs is "Devin Review", which is informational and never blocks merge.

## Devin Secrets Needed

None for local testing. Optional (not used in these tests): `SMTP_URL`, `SMTP_FROM` for email alerts.
