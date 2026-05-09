import { DISTRICT_LAYOUT } from '@/lib/district-layout';

interface DistrictInfo {
  id: string;
  name: string;
  citizenCount: number;
}

interface DistrictLayerProps {
  districts: DistrictInfo[];
}

export function DistrictLayer({ districts }: DistrictLayerProps): React.ReactElement {
  const districtMap = new Map(districts.map(d => [d.id, d]));

  return (
    <g>
      {Object.values(DISTRICT_LAYOUT).map(layout => {
        const info = districtMap.get(layout.id);
        const name = info?.name ?? layout.id;
        const count = info?.citizenCount ?? 0;

        return (
          <g key={layout.id}>
            <rect
              x={layout.x}
              y={layout.y}
              width={layout.width}
              height={layout.height}
              fill={layout.fill}
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
