import { PrismaClient } from '@wixbury/db';
import { Citizen, CitizenTraits, EventType, JobType, RelationshipType } from '@wixbury/shared';
import {
  RELATIONSHIP_SCORE_CHANGE_PER_TICK,
  RELATIONSHIP_FRIEND_THRESHOLD,
  RELATIONSHIP_RIVAL_THRESHOLD,
  RELATIONSHIP_CAP,
  RELATIONSHIP_ROMANTIC_SCORE_THRESHOLD,
  RELATIONSHIP_ROMANTIC_SOCIABILITY_MAX_DIFF,
  MIN_ROMANTIC_AGE,
  MIN_SOCIAL_AGE,
} from './constants';
import { PendingEvent } from './event-emitter';
import { scoreSignificance } from './significance-scorer';

interface RelationshipRecord {
  id: string;
  citizenAId: string;
  citizenBId: string;
  score: number;
  type: RelationshipType;
  formedAt: number;
  lastUpdated: number;
  dirty: boolean;
}

type RelationshipKey = string;

function makeKey(aId: string, bId: string): RelationshipKey {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

function computeCompatibility(a: CitizenTraits, b: CitizenTraits): number {
  const diffs = [
    Math.abs(a.ambition - b.ambition),
    Math.abs(a.honesty - b.honesty),
    Math.abs(a.sociability - b.sociability),
    Math.abs(a.empathy - b.empathy),
    Math.abs(a.riskTolerance - b.riskTolerance),
  ];
  return 1 - diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
}

function resolveType(
  score: number,
  aJob: JobType,
  bJob: JobType,
  aSociability: number,
  bSociability: number,
  aAge: number,
  bAge: number,
): RelationshipType {
  const eitherMinor = aAge < MIN_ROMANTIC_AGE || bAge < MIN_ROMANTIC_AGE;
  if (score < RELATIONSHIP_RIVAL_THRESHOLD) return RelationshipType.Rival;
  if (
    !eitherMinor &&
    score >= RELATIONSHIP_ROMANTIC_SCORE_THRESHOLD &&
    Math.abs(aSociability - bSociability) < RELATIONSHIP_ROMANTIC_SOCIABILITY_MAX_DIFF
  ) {
    return RelationshipType.Romantic;
  }
  if (score >= RELATIONSHIP_FRIEND_THRESHOLD) return RelationshipType.Friend;
  if (aJob === bJob && aJob !== JobType.Unemployed) return RelationshipType.Colleague;
  return RelationshipType.Acquaintance;
}

export class RelationshipEngine {
  private readonly map = new Map<RelationshipKey, RelationshipRecord>();

  async load(prisma: PrismaClient): Promise<void> {
    const rows = await prisma.relationship.findMany();
    for (const row of rows) {
      const key = makeKey(row.citizenAId, row.citizenBId);
      this.map.set(key, {
        id: row.id,
        citizenAId: row.citizenAId,
        citizenBId: row.citizenBId,
        score: row.score,
        type: row.type as RelationshipType,
        formedAt: row.formedAt,
        lastUpdated: row.lastUpdated,
        dirty: false,
      });
    }
  }

  processColocations(citizens: Citizen[], tickNumber: number): PendingEvent[] {
    const groups = new Map<string, Citizen[]>();
    for (const c of citizens) {
      const existing = groups.get(c.currentLocationId);
      if (existing) {
        existing.push(c);
      } else {
        groups.set(c.currentLocationId, [c]);
      }
    }

    const events: PendingEvent[] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const ev = this.updatePair(group[i], group[j], tickNumber);
          if (ev) events.push(ev);
        }
      }
    }
    return events;
  }

  private updatePair(a: Citizen, b: Citizen, tick: number): PendingEvent | null {
    const aIsParentOfB = b.parentAId === a.id || b.parentBId === a.id;
    const bIsParentOfA = a.parentAId === b.id || a.parentBId === b.id;
    const areParentChild = aIsParentOfB || bIsParentOfA;

    // Under MIN_SOCIAL_AGE: only interact with own parents
    if ((a.age < MIN_SOCIAL_AGE || b.age < MIN_SOCIAL_AGE) && !areParentChild) return null;

    // Minor↔adult: only allowed if parent–child
    const aIsMinor = a.age < MIN_ROMANTIC_AGE;
    const bIsMinor = b.age < MIN_ROMANTIC_AGE;
    if (aIsMinor !== bIsMinor && !areParentChild) return null;

    const key = makeKey(a.id, b.id);
    const compatibility = computeCompatibility(a.traits, b.traits);
    const scoreChange = (compatibility - 0.5) * RELATIONSHIP_SCORE_CHANGE_PER_TICK;

    const existing = this.map.get(key);
    if (!existing) {
      this.enforceCapFor(a);
      this.enforceCapFor(b);

      const [aId, bId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const initialScore = Math.max(-1, Math.min(1, scoreChange));
      const rec: RelationshipRecord = {
        id: crypto.randomUUID(),
        citizenAId: aId,
        citizenBId: bId,
        score: initialScore,
        type: resolveType(initialScore, a.job, b.job, a.traits.sociability, b.traits.sociability, a.age, b.age),
        formedAt: tick,
        lastUpdated: tick,
        dirty: true,
      };
      this.map.set(key, rec);

      return {
        type: EventType.RelationshipFormed,
        occurredAt: tick,
        citizenIds: [a.id, b.id],
        data: { citizenAName: a.name, citizenBName: b.name, initialScore: rec.score },
        significance: scoreSignificance(EventType.RelationshipFormed, [a, b]),
      };
    }

    const prevType = existing.type;
    existing.score = Math.max(-1, Math.min(1, existing.score + scoreChange));
    existing.type = resolveType(existing.score, a.job, b.job, a.traits.sociability, b.traits.sociability, a.age, b.age);
    existing.lastUpdated = tick;
    existing.dirty = true;

    if (existing.type !== prevType) {
      return {
        type: EventType.RelationshipChanged,
        occurredAt: tick,
        citizenIds: [a.id, b.id],
        data: {
          citizenAName: a.name,
          citizenBName: b.name,
          from: prevType,
          to: existing.type,
          score: existing.score,
        },
        significance: scoreSignificance(EventType.RelationshipChanged, [a, b]),
      };
    }

    return null;
  }

  private enforceCapFor(citizen: Citizen): void {
    const rels = [...this.map.values()].filter(
      r => r.citizenAId === citizen.id || r.citizenBId === citizen.id,
    );
    if (rels.length < RELATIONSHIP_CAP) return;

    const acquaintances = rels
      .filter(r => r.type === RelationshipType.Acquaintance)
      .sort((a, b) => a.score - b.score);

    if (acquaintances.length > 0) {
      this.map.delete(makeKey(acquaintances[0].citizenAId, acquaintances[0].citizenBId));
    }
  }

  async syncDirty(prisma: PrismaClient): Promise<void> {
    const dirty = [...this.map.values()].filter(r => r.dirty);
    if (dirty.length === 0) return;

    await prisma.$transaction(
      dirty.map(r =>
        prisma.relationship.upsert({
          where: { citizenAId_citizenBId: { citizenAId: r.citizenAId, citizenBId: r.citizenBId } },
          create: {
            id: r.id,
            citizenAId: r.citizenAId,
            citizenBId: r.citizenBId,
            score: r.score,
            type: r.type,
            formedAt: r.formedAt,
            lastUpdated: r.lastUpdated,
          },
          update: {
            score: r.score,
            type: r.type,
            lastUpdated: r.lastUpdated,
          },
        }),
      ),
    );

    for (const r of dirty) r.dirty = false;
  }

  getScore(aId: string, bId: string): number {
    const key = makeKey(aId, bId);
    return this.map.get(key)?.score ?? 0;
  }

  getRomanticPairs(): Array<[string, string]> {
    return [...this.map.values()]
      .filter(r => r.type === RelationshipType.Romantic)
      .map(r => [r.citizenAId, r.citizenBId] as [string, string]);
  }

  getCount(): number {
    return this.map.size;
  }
}
