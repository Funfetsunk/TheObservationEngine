-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "character" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "bornAt" INTEGER NOT NULL,
    "diedAt" INTEGER,
    "homeDistrictId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "biography" TEXT,
    "traitAmbition" DOUBLE PRECISION NOT NULL,
    "traitHonesty" DOUBLE PRECISION NOT NULL,
    "traitSociability" DOUBLE PRECISION NOT NULL,
    "traitEmpathy" DOUBLE PRECISION NOT NULL,
    "traitRiskTolerance" DOUBLE PRECISION NOT NULL,
    "traitReligiosity" DOUBLE PRECISION NOT NULL,
    "traitPolitical" DOUBLE PRECISION NOT NULL,
    "needHunger" DOUBLE PRECISION NOT NULL,
    "needEnergy" DOUBLE PRECISION NOT NULL,
    "needSocial" DOUBLE PRECISION NOT NULL,
    "currentAction" TEXT NOT NULL,
    "currentLocationId" TEXT NOT NULL,
    "workedTodayTicks" INTEGER NOT NULL DEFAULT 0,
    "wealth" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "citizens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "citizenAId" TEXT NOT NULL,
    "citizenBId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "formedAt" INTEGER NOT NULL,
    "lastUpdated" INTEGER NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" INTEGER NOT NULL,
    "districtId" TEXT,
    "citizenIds" TEXT[],
    "data" JSONB NOT NULL,
    "significance" DOUBLE PRECISION NOT NULL,
    "writtenUp" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "ownerId" TEXT,
    "openedAt" INTEGER NOT NULL,
    "closedAt" INTEGER,
    "employeeIds" TEXT[],

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newspaper_editions" (
    "id" TEXT NOT NULL,
    "editionAt" INTEGER NOT NULL,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newspaper_editions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "relationships_citizenAId_citizenBId_key" ON "relationships"("citizenAId", "citizenBId");

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_homeDistrictId_fkey" FOREIGN KEY ("homeDistrictId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_citizenAId_fkey" FOREIGN KEY ("citizenAId") REFERENCES "citizens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_citizenBId_fkey" FOREIGN KEY ("citizenBId") REFERENCES "citizens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
