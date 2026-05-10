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

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function getCitizenPosition(
  citizenId: string,
  layout: DistrictLayout,
): { x: number; y: number } {
  const h = fnv1a(citizenId);
  const nx = (h & 0xffff) / 0xffff;
  const ny = (h >>> 16) / 0xffff;
  const mx = 12;
  const topMargin = 40; // clear district name + resident count labels
  const bottomMargin = 12;
  return {
    x: layout.x + mx + nx * (layout.width - mx * 2),
    y: layout.y + topMargin + ny * (layout.height - topMargin - bottomMargin),
  };
}
