import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs-client.js";
import { LocalTime } from "js-joda";
import Pull from "../model/pull.js";
import Report from "../model/report.js";
import SpeedRanking from "../model/speed-ranking.js";
import Encounter from "../model/encounter.js";
import logger from "../../logger.js";

class ReportService {
  constructor(fflogsConfiguration, maxEncounters) {
    this.fflogsClient = new FflogsClient(fflogsConfiguration);
    this.maxEncounters = maxEncounters;
  }

  async init() {
    await this.fflogsClient.init();
  }

  async synthesize(reportCode) {
    let data = null;
    try {
      data = await this.fflogsClient.getReport(reportCode);
    } catch (error) {
      return Promise.reject(error);
    }

    return await this.buildReport(data.reportData.report, reportCode);
  }

  async getSpeedRanking(reportCode, encounters) {
    const fightIDs = [];
    for (let encounter of encounters.values()) {
      if (encounter.kill) {
        fightIDs.push(encounter.fightID);
      }
    }

    if (fightIDs.length == 0) {
      return Promise.reject("No rankings to retrieve");
    }

    let rankings = null;

    try {
      rankings = await this.fflogsClient.getSpeedRanking(reportCode, fightIDs);
    } catch (error) {
      return Promise.reject(error);
    }

    rankings = rankings.reportData.report.rankings.data
      .filter((ranking) => !isNaN(ranking.speed.rankPercent))
      .map((ranking) => {
        return {
          fightID: ranking.fightID,
          speedRanking: ranking.speed.rankPercent,
        };
      });

    return Promise.resolve(rankings);
  }

  async buildReport(rawReport, reportCode) {
    const startInstant = Instant.ofEpochMilli(rawReport.startTime);
    const startTime = ZonedDateTime.ofInstant(
      startInstant,
      ZoneId.systemDefault()
    );
    const endInstant = Instant.ofEpochMilli(rawReport.endTime);
    const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault());

    const encounters = this.buildFights(rawReport);
    const bestPulls = getBestPulls(encounters);
    consolidateEncountersWithBestPull(encounters, bestPulls);
    try {
      const rankings = await this.getSpeedRanking(reportCode, bestPulls);
      consolidateEncountersWithRanking(encounters, bestPulls, rankings);
    } catch (error) {
      logger.error(error);
    }

    const report = new Report(
      rawReport.title,
      startTime,
      endTime,
      encounters,
      rawReport.owner?.name,
      rawReport.guild?.name
    );
    return new Promise((resolve, reject) => {
      resolve(report);
    });
  }

  buildFights(report) {
    const highDifficultyFights = getHighestDifficultyFights(report.fights);
    const sortedEncounters = sortEncountersByPullNumber(
      highDifficultyFights,
      this.maxEncounters || 1
    );

    const encounters = new Map();
    const killsAndWipes = getKillAndWipeNumbers(sortedEncounters);
    for (let [name, rawPulls] of sortedEncounters.entries()) {
      if (!encounters.has(name)) {
        encounters.set(name, new Encounter());
      }
      rawPulls.forEach((rawPull, index) => {
        const encounterNumber = getPullNumber(killsAndWipes, index, name);
        const duration = LocalTime.ofInstant(
          Instant.ofEpochMilli(rawPull.fight.endTime - rawPull.fight.startTime),
          ZoneId.UTC
        );
        const pull = new Pull(
          rawPull.fight.id,
          rawPull.fight.bossPercentage,
          rawPull.fight.fightPercentage,
          rawPull.fight.kill,
          duration,
          rawPull.fight.lastPhase,
          encounterNumber,
          rawPull.fight.encounterID,
          rawPull.fightNumber
        );
        encounters.get(name).addFight(pull);
      });
    }
    return encounters;
  }
}

function getBestPulls(encounters) {
  const bestPulls = new Map();
  for (let [name, encounter] of encounters.entries()) {
    const bestPull = getBestPull(encounter.fights);
    bestPulls.set(name, bestPull);
  }

  return bestPulls;
}

function consolidateEncountersWithBestPull(encounters, bestPulls) {
  for (let encounterName of bestPulls.keys()) {
    encounters.get(encounterName).rankings = new SpeedRanking(
      bestPulls.get(encounterName)
    );
  }
}

function consolidateEncountersWithRanking(encounters, bestPulls, rankings) {
  for (let encounterName of bestPulls.keys()) {
    if (
      rankings.findIndex(
        (ranking) => ranking.fightID === bestPulls.get(encounterName).fightID
      ) > -1
    ) {
      const rank = rankings.find(
        (ranking) => ranking.fightID === bestPulls.get(encounterName).fightID
      );
      encounters.get(encounterName).rankings = new SpeedRanking(
        bestPulls.get(encounterName),
        rank.speedRanking
      );
    }
  }
}

function getBestPull(pulls) {
  return pulls.reduce((prev, curr) => {
    if (!prev.kill && curr.kill) {
      return curr;
    }

    if (prev.kill && !curr.kill) {
      return prev;
    }

    if (prev.kill && curr.kill && prev.duration > curr.duration) {
      return curr;
    }

    if (prev.kill && curr.kill && prev.duration < curr.duration) {
      return prev;
    }

    if (prev.fightPercentage > curr.fightPercentage) {
      return curr;
    }
    return prev;
  });
}

function getHighestDifficultyFights(fights) {
  const pullsPerEncounters = new Map();
  fights.forEach((encounter, index) => {
    if (!pullsPerEncounters.has(encounter.name)) {
      pullsPerEncounters.set(encounter.name, []);
    }

    pullsPerEncounters.get(encounter.name).push({
      fight: encounter,
      fightNumber: index + 1,
    });
  });

  const highestDifficultyEncounters = new Map();
  for (let [encounterName, encounters] of pullsPerEncounters.entries()) {
    let highestDifficulty = -1;
    for (let encounter of encounters) {
      if (encounter.fight.difficulty > highestDifficulty) {
        highestDifficulty = encounter.fight.difficulty;
      }
    }

    if (
      highestDifficulty === -1 ||
      (highestDifficulty !== 11 && highestDifficulty < 100)
    ) {
      continue;
    }
    const difficultEncounters = encounters.filter(
      (encounter) =>
        encounter.fight.difficulty === highestDifficulty &&
        (highestDifficulty >= 100 || highestDifficulty === 11)
    );

    if (!highestDifficultyEncounters.has(encounterName)) {
      highestDifficultyEncounters.set(encounterName, []);
    }
    highestDifficultyEncounters.set(
      encounterName,
      highestDifficultyEncounters.get(encounterName).concat(difficultEncounters)
    );
  }
  return highestDifficultyEncounters;
}

function sortEncountersByPullNumber(fights, maxEncounters) {
  const sortedFights = new Map();
  while (fights.size > 0 && sortedFights.size < maxEncounters) {
    const encounter = getEncounterWithMostPulls(fights);
    sortedFights.set(encounter.name, fights.get(encounter.name));
    fights.delete(encounter.name);
  }
  return sortedFights;
}

function getEncounterWithMostPulls(fights) {
  let encounterId = -1;
  let pullCount = -1;
  let encounterName = "";
  for (let [key, fight] of fights.entries()) {
    if (
      fight.length > pullCount ||
      (fight.length === pullCount && fight.encounterID > encounterId)
    ) {
      pullCount = fight.length;
      encounterId = fight[0].fight.encounterID;
      encounterName = key;
    }
  }
  return { name: encounterName, id: encounterId };
}

function getKillAndWipeNumbers(pulls) {
  const kills = new Map();
  const wipes = new Map();
  for (let [name, encounters] of pulls.entries()) {
    if (!kills.has(name)) {
      kills.set(name, []);
    }
    if (!wipes.has(name)) {
      wipes.set(name, []);
    }
    encounters.forEach((encounter, index) => {
      if (encounter.fight.kill) {
        kills.get(name).push(index + 1);
      } else {
        wipes.get(name).push(index + 1);
      }
    });
  }

  return { kills, wipes };
}

function getPullNumber(killAndWipes, curIndex, encounter) {
  let killOrWipeNumber = killAndWipes.wipes
    .get(encounter)
    .indexOf(curIndex + 1);
  if (killOrWipeNumber === -1) {
    killOrWipeNumber = killAndWipes.kills.get(encounter).indexOf(curIndex + 1);
  }

  return killOrWipeNumber + 1;
}

export { ReportService };
