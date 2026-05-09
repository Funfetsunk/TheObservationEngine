export enum BusinessType {
  Pub = 'pub',
  Shop = 'shop',
  Factory = 'factory',
  Clinic = 'clinic',
  School = 'school',
  Church = 'church',
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  districtId: string;
  ownerId: string | null;
  openedAt: number;
  closedAt: number | null;
  employeeIds: string[];
}
