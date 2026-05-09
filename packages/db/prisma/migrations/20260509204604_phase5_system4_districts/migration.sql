-- AlterTable
ALTER TABLE "districts" ADD COLUMN     "populationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "wealthScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "builtAt" INTEGER NOT NULL,
    "demolishedAt" INTEGER,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
