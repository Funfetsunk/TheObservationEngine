export enum DistrictId {
  TownCentre = 'town_centre',
  Millside = 'millside',
  Harrowgate = 'harrowgate',
  TheWorks = 'the_works',
}

export enum LocationId {
  TownHall = 'town_hall',
  WixburyGazette = 'wixbury_gazette',
  TownMarket = 'town_market',
  MinersRest = 'miners_rest',
  MillsideHomes = 'millside_homes',
  MillsideCommunitySpace = 'millside_community_space',
  HarrowgateHomes = 'harrowgate_homes',
  StAlfredsChurch = 'st_alfreds_church',
  Factory = 'factory',
  Warehouse = 'warehouse',
  ParkRangersGround = 'park_rangers_ground',
}

export interface District {
  id: DistrictId;
  name: string;
  character: string;
}
