import { PrismaClient } from '@wixbury/db';
import { Building, BuildingType, Citizen, EventType } from '@wixbury/shared';
import {
  BUILDING_CONSTRUCTION_PROBABILITY,
  BUILDING_CONSTRUCTION_WEALTH_COST,
  BUILDING_DEMOLITION_PROBABILITY,
  BUILDING_MIN_AGE_FOR_DEMOLITION_TICKS,
  DISTRICT_WEALTH_DRIFT_RATE,
  DISTRICT_WEALTH_NORMALIZATION_CAP,
} from './constants';
import { PendingEvent } from './event-emitter';
import { scoreSignificance } from './significance-scorer';

export interface RuntimeDistrict {
  id: string;
  name: string;
  character: string;
  wealthScore: number;
  populationScore: number;
}

const BUILDING_NAMES: Record<BuildingType, string[]> = {
  [BuildingType.Housing]:  ['Terrace Houses', 'Victory Row', 'Mill Cottages', 'Jubilee Terrace', 'Ashcroft Row'],
  [BuildingType.Pub]:      ['The Crown Arms', 'The Fox & Hound', 'The Wheat Sheaf', 'The Tap Room'],
  [BuildingType.Shop]:     ["Barlow's Hardware", 'The Corner Shop', "Fletcher's Goods", 'Market Stores'],
  [BuildingType.Factory]:  ['Northern Foundry', 'Croft Works', 'Mill Street Factory', 'The Ironworks'],
  [BuildingType.Park]:     ['Wixbury Park', 'Memorial Gardens', 'Victoria Park', 'The Common'],
  [BuildingType.Church]:   ["St Peter's", "Our Lady's Chapel", "St Cuthbert's"],
  [BuildingType.Clinic]:   ['Wixbury Clinic', 'The Surgery', 'Millside Health Centre'],
  [BuildingType.School]:   ['Wixbury Junior School', 'The Academy', 'Northern College'],
};

const BUILDING_CAPACITY: Record<BuildingType, number> = {
  [BuildingType.Housing]:  10,
  [BuildingType.Pub]:      8,
  [BuildingType.Shop]:     6,
  [BuildingType.Factory]:  30,
  [BuildingType.Park]:     100,
  [BuildingType.Church]:   12,
  [BuildingType.Clinic]:   8,
  [BuildingType.School]:   20,
};

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickBuildingType(wealthScore: number, existingTypes: Set<string>): BuildingType {
  if (wealthScore < 0.3) {
    return existingTypes.has(BuildingType.Factory) ? BuildingType.Housing : BuildingType.Factory;
  }
  if (wealthScore < 0.5) {
    return randFrom([BuildingType.Shop, BuildingType.Housing, BuildingType.Pub]);
  }
  if (wealthScore < 0.7) {
    return randFrom([BuildingType.Shop, BuildingType.Park, BuildingType.School]);
  }
  return randFrom([BuildingType.Park, BuildingType.Clinic, BuildingType.School]);
}

function updateCharacter(wealthScore: number): string {
  if (wealthScore < 0.20) return 'deprived industrial';
  if (wealthScore < 0.40) return 'working-class residential';
  if (wealthScore < 0.60) return 'mixed community';
  if (wealthScore < 0.80) return 'recovering residential';
  return 'affluent professional';
}

export class DistrictEngine {
  async tickWealthDrift(
    districts: RuntimeDistrict[],
    citizens: Citizen[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const totalLiving = citizens.length;

    for (const district of districts) {
      const residents = citizens.filter(c => c.homeDistrictId === district.id);
      if (residents.length === 0) continue;

      const meanWealth = residents.reduce((sum, c) => sum + c.wealth, 0) / residents.length;
      const targetWealth = Math.min(1, meanWealth / DISTRICT_WEALTH_NORMALIZATION_CAP);
      const prevScore = district.wealthScore;
      district.wealthScore += (targetWealth - district.wealthScore) * DISTRICT_WEALTH_DRIFT_RATE;
      district.wealthScore = Math.max(0, Math.min(1, district.wealthScore));

      district.populationScore = totalLiving > 0 ? residents.length / totalLiving : 0;

      const newCharacter = updateCharacter(district.wealthScore);
      const characterChanged = newCharacter !== district.character;
      const wealthShifted = Math.abs(district.wealthScore - prevScore) > 0.1;

      if (characterChanged || wealthShifted) {
        district.character = newCharacter;
        events.push({
          type: EventType.DistrictEvolved,
          occurredAt: tickNumber,
          citizenIds: [],
          data: { districtId: district.id, districtName: district.name, newCharacter, wealthScore: district.wealthScore },
          significance: scoreSignificance(EventType.DistrictEvolved, []),
        });
      }

      await prisma.district.update({
        where: { id: district.id },
        data: { wealthScore: district.wealthScore, populationScore: district.populationScore, character: district.character },
      });
    }

    return events;
  }

  async checkConstruction(
    districts: RuntimeDistrict[],
    citizens: Citizen[],
    buildings: Building[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];

    for (const district of districts) {
      const wealthyCitizens = citizens.filter(
        c => c.homeDistrictId === district.id && c.wealth >= BUILDING_CONSTRUCTION_WEALTH_COST,
      );
      if (wealthyCitizens.length < 2) continue;
      if (Math.random() >= BUILDING_CONSTRUCTION_PROBABILITY) continue;

      const existing = new Set(buildings.filter(b => b.districtId === district.id && b.demolishedAt === null).map(b => b.type));
      const buildingType = pickBuildingType(district.wealthScore, existing);
      const name = pickBuildingType(district.wealthScore, existing) && randFrom(BUILDING_NAMES[buildingType]);

      const patron = wealthyCitizens.sort((a, b) => b.wealth - a.wealth)[0];
      patron.wealth -= BUILDING_CONSTRUCTION_WEALTH_COST;

      const building: Building = {
        id: crypto.randomUUID(),
        name,
        type: buildingType,
        districtId: district.id,
        builtAt: tickNumber,
        demolishedAt: null,
        capacity: BUILDING_CAPACITY[buildingType],
      };

      await prisma.building.create({
        data: {
          id: building.id,
          name: building.name,
          type: building.type,
          districtId: building.districtId,
          builtAt: building.builtAt,
          capacity: building.capacity,
        },
      });

      buildings.push(building);

      events.push({
        type: EventType.BuildingConstructed,
        occurredAt: tickNumber,
        citizenIds: [patron.id],
        data: { buildingName: name, buildingType, districtId: district.id, districtName: district.name, patronName: patron.name },
        significance: scoreSignificance(EventType.BuildingConstructed, [patron]),
      });
    }

    return events;
  }

  async checkDemolition(
    buildings: Building[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];

    for (const building of buildings) {
      if (building.demolishedAt !== null) continue;
      if (tickNumber - building.builtAt < BUILDING_MIN_AGE_FOR_DEMOLITION_TICKS) continue;
      if (Math.random() >= BUILDING_DEMOLITION_PROBABILITY) continue;

      building.demolishedAt = tickNumber;
      await prisma.building.update({
        where: { id: building.id },
        data: { demolishedAt: tickNumber },
      });

      events.push({
        type: EventType.BuildingDemolished,
        occurredAt: tickNumber,
        citizenIds: [],
        data: { buildingName: building.name, buildingType: building.type, districtId: building.districtId },
        significance: scoreSignificance(EventType.BuildingDemolished, []),
      });
    }

    return events;
  }
}
