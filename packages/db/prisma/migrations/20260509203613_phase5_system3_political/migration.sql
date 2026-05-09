-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "heldAt" INTEGER NOT NULL,
    "districtId" TEXT,
    "candidateIds" TEXT[],
    "winnerId" TEXT NOT NULL,
    "voteData" JSONB NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "passedAt" INTEGER,
    "effect" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formedAt" INTEGER NOT NULL,
    "leaderIds" TEXT[],
    "memberIds" TEXT[],
    "agenda" JSONB NOT NULL,

    CONSTRAINT "factions_pkey" PRIMARY KEY ("id")
);
