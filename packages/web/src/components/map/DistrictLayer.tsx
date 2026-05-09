import { DISTRICT_LAYOUT } from '@/lib/district-layout';

interface DistrictInfo {
  id: string;
  name: string;
  citizenCount: number;
  wealthScore?: number;
}

interface DistrictLayerProps {
  districts: DistrictInfo[];
}

function wealthFill(wealthScore: number): string {
  if (wealthScore < 0.2) return '#3b1a0a';
  if (wealthScore < 0.4) return '#4a2c10';
  if (wealthScore < 0.6) return '#3d3d15';
  if (wealthScore < 0.8) return '#1e3a20';
  return '#1a3a2a';
}

export function DistrictLayer({ districts }: DistrictLayerProps): React.ReactElement {
  const districtMap = new Map(districts.map(d => [d.id, d]));

  return (
    <g>
      {Object.values(DISTRICT_LAYOUT).map(layout => {
        const info = districtMap.get(layout.id);
        const name = info?.name ?? layout.id;
        const count = info?.citizenCount ?? 0;
        const fill = info?.wealthScore !== undefined ? wealthFill(info.wealthScore) : layout.fill;

        return (
          <g key={layout.id}>
            <rect
              x={layout.x}
              y={layout.y}
              width={layout.width}
              height={layout.height}
              fill={fill}
              stroke={layout.stroke}
              strokeWidth={1}
              rx={4}
              opacity={0.85}
            />
            <text
              x={layout.x + layout.width / 2}
              y={layout.y + 16}
              textAnchor="middle"
              fontSize={10}
              fill={layout.stroke}
              fontFamily="sans-serif"
              fontWeight="600"
              letterSpacing="0.05em"
            >
              {name.toUpperCase()}
            </text>
            <text
              x={layout.x + layout.width / 2}
              y={layout.y + 28}
              textAnchor="middle"
              fontSize={9}
              fill={layout.stroke}
              fontFamily="sans-serif"
              opacity={0.6}
            >
              {count} resident{count !== 1 ? 's' : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
