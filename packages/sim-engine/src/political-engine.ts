import { PrismaClient } from '@wixbury/db';
import { Citizen, EventType, JobType } from '@wixbury/shared';
import {
  CANDIDATE_DECLARATION_PROBABILITY,
  COUNCIL_SEATS,
  CORRUPTION_PROBABILITY_PER_WEEK,
  FACTION_FORMATION_THRESHOLD,
  FACTION_POLITICAL_SIMILARITY,
  MIN_WORK_HOURS,
  MAX_WORK_HOURS,
  POLICY_VOTE_THRESHOLD,
} from './constants';
import { PendingEvent } from './event-emitter';
import { scoreSignificance } from './significance-scorer';
import { activePolicyEffects, PolicyEffects } from './policy-effects';
import type { RelationshipEngine } from './relationship-engine';

interface PolicyTemplate {
  title: string;
  description: string;
  effect: { constant: keyof PolicyEffects; delta: number };
}

export interface PoliticalFaction {
  id: string;
  name: string;
  formedAt: number;
  leaderIds: string[];
  memberIds: string[];
  agenda: { political: number; economic: string };
}

interface ActivePolicy {
  effect: { constant: keyof PolicyEffects; delta: number };
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    title: 'Food Subsidy',
    description: 'Council subsidises local food suppliers, reducing hunger pressure.',
    effect: { constant: 'hungerDecayMultiplier', delta: -0.10 },
  },
  {
    title: 'Wage Support',
    description: 'Council establishes a minimum wage floor for all employed citizens.',
    effect: { constant: 'wageMultiplier', delta: 0.20 },
  },
  {
    title: 'Community Investment',
    description: 'Council funds community spaces, strengthening social bonds.',
    effect: { constant: 'socialDecayMultiplier', delta: -0.10 },
  },
  {
    title: 'Austerity Measures',
    description: 'Council cuts public spending to balance the books.',
    effect: { constant: 'wageMultiplier', delta: -0.15 },
  },
  {
    title: 'Rationing Programme',
    description: 'Council introduces rationing during hardship.',
    effect: { constant: 'hungerDecayMultiplier', delta: 0.10 },
  },
];

const FACTION_NAMES: Record<string, string[]> = {
  conservative: ['Wixbury Conservative League', 'The Traditionalists', 'Millside Heritage Society'],
  moderate:     ["Citizens' Alliance", 'Wixbury Moderates', 'The Centre Ground'],
  progressive:  ['Wixbury Progressive Front', "Workers' Movement", 'The Reform Society'],
};

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function factionNameForPolitical(political: number): string {
  if (political < 0.35) return randFrom(FACTION_NAMES.conservative);
  if (political > 0.65) return randFrom(FACTION_NAMES.progressive);
  return randFrom(FACTION_NAMES.moderate);
}

export class PoliticalEngine {
  async runElection(
    citizens: Citizen[],
    relationships: RelationshipEngine,
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const candidates: Citizen[] = citizens.filter(c => c.job === JobType.Councillor);

    for (const c of citizens) {
      if (c.job === JobType.Councillor) continue;
      if (c.traits.ambition > 0.6 && Math.random() < CANDIDATE_DECLARATION_PROBABILITY) {
        candidates.push(c);
      }
    }

    if (candidates.length === 0) return [];

    const votes = new Map<string, number>(candidates.map(c => [c.id, 0]));
    for (const voter of citizens) {
      for (const candidate of candidates) {
        if (voter.id === candidate.id) continue;
        const relScore = relationships.getScore(voter.id, candidate.id);
        const alignmentScore = 1 - Math.abs(voter.traits.political - candidate.traits.political);
        const weight = relScore * 0.5 + alignmentScore * 0.5;
        votes.set(candidate.id, (votes.get(candidate.id) ?? 0) + weight);
      }
    }

    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const winnerIds = new Set(ranked.slice(0, COUNCIL_SEATS).map(([id]) => id));

    for (const c of citizens) {
      if (winnerIds.has(c.id)) {
        if (c.job !== JobType.Councillor) {
          c.job = JobType.Councillor;
          c.dailyWorkTarget = Math.round(MIN_WORK_HOURS + c.traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS));
          await prisma.citizen.update({ where: { id: c.id }, data: { jobType: c.job } });
        }
      } else if (c.job === JobType.Councillor) {
        c.job = JobType.Unemployed;
        c.dailyWorkTarget = 0;
        await prisma.citizen.update({ where: { id: c.id }, data: { jobType: c.job } });
      }
    }

    const topWinnerId = ranked[0][0];
    const voteData = Object.fromEntries(votes);

    await prisma.election.create({
      data: {
        id: crypto.randomUUID(),
        heldAt: tickNumber,
        candidateIds: candidates.map(c => c.id),
        winnerId: topWinnerId,
        voteData,
      },
    });

    const winner = citizens.find(c => c.id === topWinnerId);
    return [{
      type: EventType.ElectionHeld,
      occurredAt: tickNumber,
      citizenIds: candidates.map(c => c.id),
      data: { candidateCount: candidates.length, winnerId: topWinnerId, winnerName: winner?.name ?? 'Unknown', voteData },
      significance: scoreSignificance(EventType.ElectionHeld, winner ? [winner] : []),
    }];
  }

  async proposePolicy(
    councillors: Citizen[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    if (councillors.length === 0) return [];

    const proposer = randFrom(councillors);
    const template = randFrom(POLICY_TEMPLATES);

    let yesVotes = 1; // proposer votes yes
    for (const councillor of councillors) {
      if (councillor.id === proposer.id) continue;
      if (Math.abs(proposer.traits.political - councillor.traits.political) < 0.3) {
        yesVotes++;
      }
    }

    if (yesVotes < POLICY_VOTE_THRESHOLD) return [];

    const policyId = crypto.randomUUID();
    await prisma.policy.create({
      data: {
        id: policyId,
        title: template.title,
        description: template.description,
        proposedBy: proposer.id,
        passedAt: tickNumber,
        effect: template.effect,
        active: true,
      },
    });

    const activePolicies = await prisma.policy.findMany({ where: { active: true } });
    this.applyActivePolicies(activePolicies.map(p => ({ effect: p.effect as ActivePolicy['effect'] })));

    return [{
      type: EventType.PolicyPassed,
      occurredAt: tickNumber,
      citizenIds: [proposer.id],
      data: { title: template.title, description: template.description, yesVotes, proposerName: proposer.name, effect: template.effect },
      significance: scoreSignificance(EventType.PolicyPassed, [proposer]),
    }];
  }

  applyActivePolicies(policies: ActivePolicy[]): void {
    activePolicyEffects.hungerDecayMultiplier = 1.0;
    activePolicyEffects.socialDecayMultiplier = 1.0;
    activePolicyEffects.wageMultiplier = 1.0;

    for (const policy of policies) {
      activePolicyEffects[policy.effect.constant] += policy.effect.delta;
    }

    // Clamp multipliers to reasonable bounds
    activePolicyEffects.hungerDecayMultiplier = Math.max(0.1, Math.min(3.0, activePolicyEffects.hungerDecayMultiplier));
    activePolicyEffects.socialDecayMultiplier = Math.max(0.1, Math.min(3.0, activePolicyEffects.socialDecayMultiplier));
    activePolicyEffects.wageMultiplier = Math.max(0.1, Math.min(5.0, activePolicyEffects.wageMultiplier));
  }

  async checkFactionFormation(
    citizens: Citizen[],
    factions: PoliticalFaction[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const bands = new Map<number, Citizen[]>();

    for (const c of citizens) {
      const band = Math.floor(c.traits.political / FACTION_POLITICAL_SIMILARITY) * FACTION_POLITICAL_SIMILARITY;
      const rounded = Math.round(band * 10) / 10;
      const existing = bands.get(rounded);
      if (existing) existing.push(c); else bands.set(rounded, [c]);
    }

    for (const [bandCenter, members] of bands) {
      if (members.length < FACTION_FORMATION_THRESHOLD) continue;

      const alreadyCovered = factions.some(
        f => Math.abs(f.agenda.political - bandCenter) < FACTION_POLITICAL_SIMILARITY,
      );
      if (alreadyCovered) continue;

      const name = factionNameForPolitical(bandCenter);
      const leader = members.reduce((best, c) => c.traits.ambition > best.traits.ambition ? c : best);
      const agenda = {
        political: bandCenter,
        economic: bandCenter < 0.4 ? 'conservative' : bandCenter > 0.6 ? 'progressive' : 'moderate',
      };

      const faction: PoliticalFaction = {
        id: crypto.randomUUID(),
        name,
        formedAt: tickNumber,
        leaderIds: [leader.id],
        memberIds: members.map(c => c.id),
        agenda,
      };

      await prisma.faction.create({
        data: {
          id: faction.id,
          name: faction.name,
          formedAt: faction.formedAt,
          leaderIds: faction.leaderIds,
          memberIds: faction.memberIds,
          agenda: faction.agenda,
        },
      });

      factions.push(faction);

      events.push({
        type: EventType.FactionFormed,
        occurredAt: tickNumber,
        citizenIds: [leader.id],
        data: { factionName: name, memberCount: members.length, political: bandCenter, leaderName: leader.name },
        significance: scoreSignificance(EventType.FactionFormed, [leader]),
      });
    }

    return events;
  }

  checkCorruption(councillors: Citizen[], tickNumber: number): PendingEvent[] {
    const events: PendingEvent[] = [];
    for (const c of councillors) {
      if (c.traits.honesty < 0.2 && Math.random() < CORRUPTION_PROBABILITY_PER_WEEK) {
        events.push({
          type: EventType.CorruptionAllegation,
          occurredAt: tickNumber,
          citizenIds: [c.id],
          data: { citizenName: c.name, honesty: c.traits.honesty },
          significance: scoreSignificance(EventType.CorruptionAllegation, [c]),
        });
      }
    }
    return events;
  }
}
