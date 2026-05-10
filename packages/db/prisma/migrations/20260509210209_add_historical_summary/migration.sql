-- CreateTable
CREATE TABLE "historical_summaries" (
    "id" TEXT NOT NULL,
    "simYear" INTEGER NOT NULL,
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_summaries_pkey" PRIMARY KEY ("id")
);
