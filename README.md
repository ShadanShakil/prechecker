# Carton QC — MVP

Two-stage quality control for a carton factory, built with **Next.js 16 + TypeScript + Prisma + SQLite**. Zero paid services.

- **Stage 1 – Artwork review.** Upload artwork → OCR (English + Arabic via `tesseract.js`) → spell-check each word against the bundled dictionaries (`@cspell/dict-en_us`, `@cspell/dict-ar`) → reviewer approves or rejects with suggestions.
- **Stage 2 – Printed-carton QC.** Once artwork is approved, QC uploads a photo of the printed carton. The photo is aligned to the approved artwork and compared pixel-by-pixel (`sharp` + `pixelmatch`). Anything above the configured threshold is flagged as a **mismatch** and alerts are raised.

All roles, all free, all offline.

## Roles

| Role           | Can upload artwork | Can approve / reject | Can upload printed carton | Can acknowledge alerts | Manage users |
| -------------- | :---------------: | :------------------: | :-----------------------: | :--------------------: | :----------: |
| `ADMIN`        | ✓                 | ✓                    | ✓                         | ✓                      | ✓            |
| `REVIEWER`     | ✓                 | ✓                    |                           |                        |              |
| `QC_INSPECTOR` |                   |                      | ✓                         | ✓                      |              |
| `OPERATOR`     | ✓                 |                      |                           |                        |              |

## Storage system

Files live under `STORAGE_ROOT` (default `./storage`):

```
storage/
├── artwork/
│   └── {artworkId}/
│       ├── original.{ext}        raw uploaded artwork
│       ├── normalized.png        rasterized / auto-oriented — used for OCR and as the Stage 2 reference
│       └── ocr.json              (reserved) persisted OCR dump
└── prints/
    └── {printJobId}/
        ├── original.{ext}        uploaded photo
        ├── aligned.png           resized & padded to match the artwork canvas
        ├── diff.png              pixelmatch visualization
        └── report.json           diff score + verdict
```

Swap to S3 / MinIO later by replacing `src/lib/storage.ts` — the rest of the app only references the adapter's helpers.

### Database (SQLite)

Schema lives in `prisma/schema.prisma`. Key tables:

- `User` — email, hashed password, role
- `Artwork` — status `PENDING_OCR | PENDING_REVIEW | APPROVED | REJECTED`
- `OCRWord` — each word extracted from an artwork with bbox, language (`en` / `ar`), `isMisspelled`, suggestions
- `PrintJob` — status `PROCESSING | MATCH | MISMATCH | FAILED` with `diffScore`
- `Alert` — raised on mismatch, acknowledged by admin/QC
- `Notification` — in-app bell notifications per user
- `AuditLog` — reserved for future traceability

SQLite is the default so you can run the whole thing with no external dependencies. Switch to Postgres by changing `datasource.provider` and `DATABASE_URL`.

## Local setup

```bash
# 1. Install
pnpm install

# 2. Configure env
cp .env.example .env
# (the defaults work out of the box for local dev)

# 3. Create DB schema and seed users
pnpm prisma migrate dev
pnpm db:seed

# 4. Run
pnpm dev
# open http://localhost:3000
```

### Seeded accounts (password: `password` for all)

| Role           | Email                   |
| -------------- | ----------------------- |
| ADMIN          | admin@carton.local      |
| REVIEWER       | reviewer@carton.local   |
| QC_INSPECTOR   | qc@carton.local         |
| OPERATOR       | operator@carton.local   |

## Typical workflow

1. **Operator** logs in and uploads an artwork PNG/JPG under *Artwork → Upload artwork*. OCR runs automatically; any misspelled words are highlighted.
2. **Reviewer** opens the artwork, reviews flagged words, accepts suggestions (or marks as OK), and clicks **Approve** / **Reject**.
3. Once **Approved**, **QC Inspector** uploads a photo of the printed carton under *Prints → Upload printed carton* and selects the matching artwork. The app aligns the photo and compares it to the approved reference.
4. If the diff ratio exceeds `QC_MISMATCH_THRESHOLD` (default `0.02`, i.e. 2% of pixels), the job is marked `MISMATCH`, an in-app **Alert** is raised, an in-app notification is sent to every admin, and (if SMTP is configured) an email is sent to `ADMIN_ALERT_EMAILS`.
5. **Admin / QC** acknowledges the alert from *Alerts*.

## Email alerts (optional, free)

Set these in `.env` if you want email alerts on mismatches. Gmail with an app password works and costs nothing:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="Carton QC <you@gmail.com>"
ADMIN_ALERT_EMAILS=admin@yourfactory.com
```

Leave `SMTP_*` blank and alerts will stay in-app only.

## Notes on free OCR / spell-check accuracy

- **English OCR + spell-check:** Very accurate with the bundled dictionaries.
- **Arabic OCR:** Tesseract's `ara` model works but is meaningfully less accurate than paid vendors. A reviewer-in-the-loop is mandatory for Arabic — accept suggestions or override with the correct word before approving.
- **Stage 2 alignment:** The MVP uses a contain-fit resize to match the artwork canvas. This handles centered, reasonably framed photos well. For production, replace `diffPrintAgainstArtwork` in `src/lib/image.ts` with a feature-based homography warp (e.g. OpenCV.js ORB + findHomography) — the interface stays the same.

## Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Run dev server at http://localhost:3000   |
| `pnpm build`        | Production build                          |
| `pnpm start`        | Run the production build                  |
| `pnpm lint`         | ESLint                                    |
| `pnpm typecheck`    | `tsc --noEmit`                            |
| `pnpm db:migrate`   | Apply migrations (production / CI)        |
| `pnpm db:migrate:dev` | Create + apply a new migration (dev)    |
| `pnpm db:seed`      | Insert seed users                         |
| `pnpm db:reset`     | Drop + recreate the SQLite DB             |
