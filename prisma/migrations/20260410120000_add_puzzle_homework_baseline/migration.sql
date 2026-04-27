-- Baseline migration: records changes that were applied directly to the DB via prisma db push
-- (PUZZLE HomeworkType variant and puzzleSets column on Homework)
-- This migration is marked as already applied so migrate dev can track from here.

ALTER TYPE "HomeworkType" ADD VALUE IF NOT EXISTS 'PUZZLE';

ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "puzzleSets" JSONB;
