export interface DistrictLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}

// SVG viewBox: "0 0 600 500"
// DB district IDs match these keys
export const DISTRICT_LAYOUT: Record<string, DistrictLayout> = {
  town_centre: { id: 'town_centre', x: 200, y: 150, width: 180, height: 140, fill: '#1e293b', stroke: '#475569' },
  millside:    { id: 'millside',    x: 30,  y: 240, width: 160, height: 170, fill: '#14532d', stroke: '#16a34a' },
  harrowgate:  { id: 'harrowgate',  x: 390, y: 90,  width: 170, height: 190, fill: '#2e1065', stroke: '#7c3aed' },
  the_works:   { id: 'the_works',   x: 200, y: 310, width: 210, height: 150, fill: '#451a03', stroke: '#d97706' },
};

export function getCitizenPosition(
  citizenId: string,
  layout: DistrictLayout,
): { x: number; y: number } {
  const hash = citizenId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const nx = (hash % 100) / 100;
  const ny = (Math.floor(hash / 100) % 100) / 100;
  const margin = 18;
  return {
    x: layout.x + margin + nx * (layout.width - margin * 2),
    y: layout.y + margin + ny * (layout.height - margin * 2),
  };
}
