import { District, DistrictId, JobType, LocationId } from '@wixbury/shared';

export const DISTRICT_RECORDS: ReadonlyArray<District> = [
  { id: DistrictId.TownCentre, name: 'Town Centre', character: 'Commercial and civic heart' },
  { id: DistrictId.Millside, name: 'Millside', character: 'Working-class residential' },
  { id: DistrictId.Harrowgate, name: 'Harrowgate', character: 'Slightly more affluent residential' },
  { id: DistrictId.TheWorks, name: 'The Works', character: 'Light industry and leisure' },
];

export const DISTRICT_HOME_LOCATION: Readonly<Record<DistrictId, LocationId>> = {
  [DistrictId.TownCentre]: LocationId.TownMarket,
  [DistrictId.Millside]: LocationId.MillsideHomes,
  [DistrictId.Harrowgate]: LocationId.HarrowgateHomes,
  [DistrictId.TheWorks]: LocationId.Warehouse,
};

export const JOB_WORK_LOCATION: Readonly<Record<JobType, LocationId>> = {
  [JobType.Unemployed]: LocationId.MillsideHomes,
  [JobType.Labourer]: LocationId.Factory,
  [JobType.Shopkeeper]: LocationId.TownMarket,
  [JobType.Teacher]: LocationId.TownHall,
  [JobType.Doctor]: LocationId.TownHall,
  [JobType.Councillor]: LocationId.TownHall,
  [JobType.Journalist]: LocationId.WixburyGazette,
  [JobType.Publican]: LocationId.MinersRest,
  [JobType.FactoryWorker]: LocationId.Factory,
  [JobType.Clergy]: LocationId.StAlfredsChurch,
  [JobType.Footballer]: LocationId.ParkRangersGround,
};

export const LOCATION_DISTRICT: Readonly<Record<LocationId, DistrictId>> = {
  [LocationId.TownHall]: DistrictId.TownCentre,
  [LocationId.WixburyGazette]: DistrictId.TownCentre,
  [LocationId.TownMarket]: DistrictId.TownCentre,
  [LocationId.MinersRest]: DistrictId.Millside,
  [LocationId.MillsideHomes]: DistrictId.Millside,
  [LocationId.MillsideCommunitySpace]: DistrictId.Millside,
  [LocationId.HarrowgateHomes]: DistrictId.Harrowgate,
  [LocationId.StAlfredsChurch]: DistrictId.Harrowgate,
  [LocationId.Factory]: DistrictId.TheWorks,
  [LocationId.Warehouse]: DistrictId.TheWorks,
  [LocationId.ParkRangersGround]: DistrictId.TheWorks,
};

export function getHomeLocation(districtId: DistrictId): LocationId {
  return DISTRICT_HOME_LOCATION[districtId];
}
