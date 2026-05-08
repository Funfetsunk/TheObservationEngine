import * as fs from 'fs';
import * as path from 'path';
import { Citizen, CitizenAction, CitizenNeeds } from '@wixbury/shared';
import { ActionCounts } from './tick-engine';

interface Logger {
  logDay: (day: number, actionCounts: ActionCounts, endOfDayNeeds: CitizenNeeds) => void;
  logComplete: () => void;
}

export function createLogger(citizen: Citizen): Logger {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const safeName = citizen.name.toLowerCase().replace(/\s+/g, '-');
  const filePath = path.join(logsDir, `${safeName}.log`);
  const stream = fs.createWriteStream(filePath, { flags: 'w' });

  const t = citizen.traits;
  const workLabel = citizen.dailyWorkTarget === 0 ? 'unemployed' : `${citizen.dailyWorkTarget}h/day`;
  stream.write(`${citizen.name}, age ${citizen.age}, ${citizen.job} (${workLabel})\n`);
  stream.write(
    `ambition=${t.ambition.toFixed(2)} honesty=${t.honesty.toFixed(2)} ` +
    `sociability=${t.sociability.toFixed(2)} empathy=${t.empathy.toFixed(2)} ` +
    `risk=${t.riskTolerance.toFixed(2)} religiosity=${t.religiosity.toFixed(2)} ` +
    `political=${t.political.toFixed(2)}\n\n`,
  );

  console.log(`Log: ${filePath}`);

  function logDay(day: number, actionCounts: ActionCounts, endOfDayNeeds: CitizenNeeds): void {
    const parts: string[] = [];
    if (actionCounts[CitizenAction.Working] > 0) parts.push(`worked ${actionCounts[CitizenAction.Working]}h`);
    if (actionCounts[CitizenAction.Leisure] > 0) parts.push(`leisure ${actionCounts[CitizenAction.Leisure]}h`);
    if (actionCounts[CitizenAction.Eating] > 0) parts.push(`ate ${actionCounts[CitizenAction.Eating]}h`);
    if (actionCounts[CitizenAction.Sleeping] > 0) parts.push(`slept ${actionCounts[CitizenAction.Sleeping]}h`);
    if (actionCounts[CitizenAction.Socialising] > 0) parts.push(`socialised ${actionCounts[CitizenAction.Socialising]}h`);

    const { hunger, energy, social } = endOfDayNeeds;
    const needs = `hunger=${hunger.toFixed(2)} energy=${energy.toFixed(2)} social=${social.toFixed(2)}`;
    stream.write(`Day ${String(day).padStart(3)} | ${parts.join(', ')} | ${needs}\n`);
  }

  function logComplete(): void {
    stream.write('\nSimulation complete.\n');
    stream.end();
  }

  return { logDay, logComplete };
}
