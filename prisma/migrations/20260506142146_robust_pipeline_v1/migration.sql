-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN "printableCoverage" REAL;
ALTER TABLE "Artwork" ADD COLUMN "printableH" INTEGER;
ALTER TABLE "Artwork" ADD COLUMN "printableMaskPath" TEXT;
ALTER TABLE "Artwork" ADD COLUMN "printableW" INTEGER;
ALTER TABLE "Artwork" ADD COLUMN "printableX" INTEGER;
ALTER TABLE "Artwork" ADD COLUMN "printableY" INTEGER;

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN "alignmentConfidence" REAL;
ALTER TABLE "PrintJob" ADD COLUMN "globalDiffScore" REAL;
ALTER TABLE "PrintJob" ADD COLUMN "maskedDiffScore" REAL;
ALTER TABLE "PrintJob" ADD COLUMN "statusReason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OCRWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artworkId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "bboxX" INTEGER NOT NULL,
    "bboxY" INTEGER NOT NULL,
    "bboxW" INTEGER NOT NULL,
    "bboxH" INTEGER NOT NULL,
    "confidence" REAL NOT NULL,
    "isMisspelled" BOOLEAN NOT NULL DEFAULT false,
    "isAnnotation" BOOLEAN NOT NULL DEFAULT false,
    "isOutsidePrintable" BOOLEAN NOT NULL DEFAULT false,
    "suggestions" TEXT,
    "overrideText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OCRWord_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OCRWord" ("artworkId", "bboxH", "bboxW", "bboxX", "bboxY", "confidence", "createdAt", "id", "isMisspelled", "language", "overrideText", "suggestions", "text") SELECT "artworkId", "bboxH", "bboxW", "bboxX", "bboxY", "confidence", "createdAt", "id", "isMisspelled", "language", "overrideText", "suggestions", "text" FROM "OCRWord";
DROP TABLE "OCRWord";
ALTER TABLE "new_OCRWord" RENAME TO "OCRWord";
CREATE INDEX "OCRWord_artworkId_idx" ON "OCRWord"("artworkId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
