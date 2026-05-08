import { createCitizen } from './citizen-agent';
import { startTickEngine } from './tick-engine';
import { createLogger } from './logger';
import { SIM_DAYS_TO_RUN } from './constants';

const citizen = createCitizen();
const logger = createLogger(citizen);

console.log(`${citizen.name}, age ${citizen.age}, ${citizen.job}`);
console.log(`Running ${SIM_DAYS_TO_RUN} simulated days...\n`);

startTickEngine(
  citizen,
  (day, actionCounts, endOfDayNeeds) => {
    logger.logDay(day, actionCounts, endOfDayNeeds);
    if (day % 10 === 0) {
      console.log(`  Day ${day}/${SIM_DAYS_TO_RUN}`);
    }
  },
  () => {
    logger.logComplete();
    console.log('\nDone.');
    process.exit(0);
  },
);
