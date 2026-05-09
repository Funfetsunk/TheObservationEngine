export interface CityStateResponse {
  tick: number;
  simulatedAt: string;
  citizenCount: number;
  livingCount: number;
  eventsFiredToday: number;
}

export interface CitizenSummary {
  id: string;
  name: string;
  age: number;
  jobType: string;
  districtId: string;
  districtName: string;
  currentActivity: string;
  biography: string | null;
}

export interface CitizensResponse {
  citizens: CitizenSummary[];
  total: number;
  page: number;
}

export interface RelationshipSummary {
  citizenId: string;
  citizenName: string;
  score: number;
  type: string;
  formedAt: string;
}

export interface CitizenProfileResponse {
  id: string;
  name: string;
  age: number;
  bornAt: string;
  diedAt: string | null;
  jobType: string;
  biography: string | null;
  traits: {
    ambition: number;
    honesty: number;
    sociability: number;
    empathy: number;
    riskTolerance: number;
    religiosity: number;
    political: number;
  };
  needs: {
    hunger: number;
    energy: number;
    social: number;
  };
  currentActivity: string;
  districtId: string;
  districtName: string;
  relationships: RelationshipSummary[];
}

export interface CitizenEventSummary {
  id: string;
  type: string;
  occurredAt: string;
  significance: number;
  districtName: string | null;
  data: Record<string, unknown>;
}

export interface CitizenEventsResponse {
  events: CitizenEventSummary[];
  total: number;
}

export interface DistrictSummary {
  id: string;
  name: string;
  character: string;
  citizenCount: number;
  wealthScore: number;
}

export interface DistrictsResponse {
  districts: DistrictSummary[];
}

export interface BuildingSummary {
  id: string;
  name: string;
  type: string;
  districtId: string;
  districtName: string;
  builtAt: number;
  capacity: number;
}

export interface BuildingsResponse {
  buildings: BuildingSummary[];
}

export interface DistrictDetailResponse {
  id: string;
  name: string;
  character: string;
  wealthScore: number;
  populationScore: number;
  citizenCount: number;
  buildings: BuildingSummary[];
}

export interface EditionSummary {
  id: string;
  editionNumber: number;
  publishedAt: string;
  headline: string;
}

export interface NewspaperIndexResponse {
  editions: EditionSummary[];
  total: number;
  page: number;
}

export interface NewspaperEditionResponse {
  id: string;
  editionNumber: number;
  publishedAt: string;
  content: string;
  eventsCount: number;
}

export interface EventSummary {
  id: string;
  type: string;
  occurredAt: string;
  significance: number;
  citizenNames: string[];
  districtName: string | null;
  data: Record<string, unknown>;
}

export interface EventsResponse {
  events: EventSummary[];
}
