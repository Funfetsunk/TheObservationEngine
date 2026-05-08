import { PrismaClient } from '@wixbury/db';
import { DistrictId, JobType } from '@wixbury/shared';
import { DISTRICT_RECORDS, JOB_WORK_LOCATION } from './world';
import { createCitizen } from './citizen-agent';

interface SeedSpec {
  districtId: DistrictId;
  jobType: JobType;
}

const SEED_SPECS: ReadonlyArray<SeedSpec> = [
  { districtId: DistrictId.TownCentre, jobType: JobType.Journalist },
  { districtId: DistrictId.TownCentre, jobType: JobType.Publican },
  { districtId: DistrictId.TownCentre, jobType: JobType.Councillor },
  { districtId: DistrictId.TownCentre, jobType: JobType.Councillor },
  { districtId: DistrictId.Millside, jobType: JobType.Labourer },
  { districtId: DistrictId.Millside, jobType: JobType.FactoryWorker },
  { districtId: DistrictId.Millside, jobType: JobType.FactoryWorker },
  { districtId: DistrictId.Millside, jobType: JobType.Unemployed },
  { districtId: DistrictId.Harrowgate, jobType: JobType.Teacher },
  { districtId: DistrictId.Harrowgate, jobType: JobType.Doctor },
  { districtId: DistrictId.Harrowgate, jobType: JobType.Shopkeeper },
  { districtId: DistrictId.Harrowgate, jobType: JobType.Clergy },
  { districtId: DistrictId.TheWorks, jobType: JobType.FactoryWorker },
  { districtId: DistrictId.TheWorks, jobType: JobType.FactoryWorker },
  { districtId: DistrictId.TheWorks, jobType: JobType.Footballer },
];

export async function seed(prisma: PrismaClient): Promise<void> {
  console.log(JSON.stringify({ event: 'seed_start' }));

  for (const d of DISTRICT_RECORDS) {
    await prisma.district.create({ data: { id: d.id, name: d.name, character: d.character } });
  }

  for (const spec of SEED_SPECS) {
    const citizen = createCitizen(spec.districtId, spec.jobType);
    await prisma.citizen.create({
      data: {
        id: citizen.id,
        name: citizen.name,
        age: citizen.age,
        bornAt: 0,
        homeDistrictId: citizen.homeDistrictId,
        jobType: citizen.job,
        traitAmbition: citizen.traits.ambition,
        traitHonesty: citizen.traits.honesty,
        traitSociability: citizen.traits.sociability,
        traitEmpathy: citizen.traits.empathy,
        traitRiskTolerance: citizen.traits.riskTolerance,
        traitReligiosity: citizen.traits.religiosity,
        traitPolitical: citizen.traits.political,
        needHunger: citizen.needs.hunger,
        needEnergy: citizen.needs.energy,
        needSocial: citizen.needs.social,
        currentAction: citizen.currentAction,
        currentLocationId: citizen.currentLocationId,
        workedTodayTicks: 0,
      },
    });
  }

  console.log(JSON.stringify({
    event: 'seed_complete',
    citizens: SEED_SPECS.length,
    districts: DISTRICT_RECORDS.length,
  }));
}
