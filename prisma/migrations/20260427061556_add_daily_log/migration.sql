-- CreateEnum
CREATE TYPE "PracticeCategory" AS ENUM ('OPENINGS', 'TACTICS', 'ENDGAMES');

-- CreateEnum
CREATE TYPE "LogWorksheetStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" "PracticeCategory" NOT NULL,
    "gamesPlayed" INTEGER,
    "minutesSpent" INTEGER,
    "worksheetStatus" "LogWorksheetStatus",
    "notes" TEXT,
    "classroomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_classroomId_date_key" ON "DailyLog"("classroomId", "date");

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
