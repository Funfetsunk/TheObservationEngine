export enum BuildingType {
  Housing = 'housing',
  Pub = 'pub',
  Shop = 'shop',
  Factory = 'factory',
  Park = 'park',
  Church = 'church',
  Clinic = 'clinic',
  School = 'school',
}

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  districtId: string;
  builtAt: number;
  demolishedAt: number | null;
  capacity: number;
}
