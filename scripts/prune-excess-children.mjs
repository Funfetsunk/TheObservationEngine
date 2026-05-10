// One-off script: removes children that exceed each couple's deterministic max (1-4).
// Uses same hash as population-engine.ts coupleMaxChildren.
import { execSync } from 'child_process';

const COUPLE_MAX_CHILDREN_MIN = 1;
const COUPLE_MAX_CHILDREN_MAX = 4;

function coupleMaxChildren(aId, bId) {
  const combined = [aId, bId].sort().join('');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = Math.imul(hash * 31 + combined.charCodeAt(i), 1) >>> 0;
  }
  const range = COUPLE_MAX_CHILDREN_MAX - COUPLE_MAX_CHILDREN_MIN + 1;
  return COUPLE_MAX_CHILDREN_MIN + (hash % range);
}

function query(sql) {
  const result = execSync(
    `docker exec wixbury-postgres psql -U postgres -d wixbury --csv -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  );
  const lines = result.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
  });
}

const children = query(
  'SELECT id, "parentAId", "parentBId", age FROM citizens WHERE "parentAId" IS NOT NULL AND "parentBId" IS NOT NULL ORDER BY "parentAId", "parentBId", age::int DESC'
);

// Group by canonical couple key (sorted IDs)
const byCouple = new Map();
for (const row of children) {
  const key = [row.parentAId, row.parentBId].sort().join('|');
  if (!byCouple.has(key)) byCouple.set(key, []);
  byCouple.get(key).push(row);
}

const toDelete = [];
for (const [key, kids] of byCouple) {
  const [aId, bId] = key.split('|');
  const max = coupleMaxChildren(aId, bId);
  // kids sorted age DESC — keep oldest up to max, delete the rest
  const excess = kids.slice(max);
  toDelete.push(...excess.map(k => k.id));
}

if (toDelete.length === 0) {
  console.log('No excess children found.');
  process.exit(0);
}

console.log(`Deleting ${toDelete.length} excess children...`);
const ids = toDelete.map(id => `'${id}'`).join(',');

// Delete relationships referencing these citizens first
execSync(
  `docker exec wixbury-postgres psql -U postgres -d wixbury -c "DELETE FROM relationships WHERE \\"citizenAId\\" IN (${ids}) OR \\"citizenBId\\" IN (${ids});"`,
  { encoding: 'utf8' },
);

const result = execSync(
  `docker exec wixbury-postgres psql -U postgres -d wixbury -c "DELETE FROM citizens WHERE id IN (${ids});"`,
  { encoding: 'utf8' },
);
console.log(result.trim());
console.log('Done.');
