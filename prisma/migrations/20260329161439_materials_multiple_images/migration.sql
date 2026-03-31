-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "imageUrls" TEXT[],
ALTER COLUMN "url" DROP NOT NULL;
