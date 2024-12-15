import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs-client.js";
import { LocalTime } from "js-joda";
import Pull from "../model/pull.js";
import Report from "../model/report.js";
import Encounter from "../model/encounter.js";
import logger from "../../logger.js";
import BestPullRanking from "../model/best-pull-ranking.js";
import objectHash from "object-hash";

class ReportService {
  constructor(fflogsConfiguration, maxEncounters) {
    this.fflogsClient = new FflogsClient(fflogsConfiguration);
    this.maxEncounters = maxEncounters;
  }

  async init() {
    await this.fflogsClient.init();
  }

  async getReport(reportCode) {
    let data = null;
    try {
      data = await this.fflogsClient.getReport(reportCode);
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(data);
  }

  async synthesizeReport(reportCode, previousRankings = new Map()) {
    const data = await this.getReport(reportCode);
    return await this.buildNewReport(
      data.reportData.report,
      reportCode,
      previousRankings
    );
  }

  async buildBestPullRankings(
    newEncounters,
    reportCode,
    previousBestPullRankings = new Map()
  ) {
    const bestPullRankings = new Map();
    for (let [newEncounterID, newEncounter] of newEncounters.entries()) {
      const newBestPull = newEncounter.bestPull;
      let ranking = null;
      let rankingAvailable = true;
      if (
        previousBestPullRankings.has(newEncounterID) &&
        objectHash(newBestPull) ===
          objectHash(previousBestPullRankings.get(newEncounterID).pull)
      ) {
        ranking = previousBestPullRankings.get(newEncounterID).ranking;
        rankingAvailable =
          previousBestPullRankings.get(newEncounterID).rankingAvailable;
      }

      bestPullRankings.set(
        newEncounterID,
        new BestPullRanking(newBestPull, ranking, rankingAvailable)
      );
    }

    let updatedRankings;
    try {
      updatedRankings = await this.getBestPullRankingPerEncounter(
        reportCode,
        bestPullRankings
      );
    } catch (warning) {
      return bestPullRankings;
    }
    for (let encounterID of updatedRankings.keys()) {
      bestPullRankings.set(encounterID, updatedRankings.get(encounterID));
    }
    return bestPullRankings;
  }

  retrieveFightIDs(currentBestPullRankings) {
    return Array.from(currentBestPullRankings.values())
      .filter(
        (curr) => curr.pull.kill && curr.rankingAvailable && !curr.ranking
      )
      .map((curr) => curr.pull.fightID);
  }

  async getBestPullRankingPerEncounter(reportCode, currentBestPullRankings) {
    const bestPulls = Array.from(currentBestPullRankings.values()).map(
      (pullRanking) => pullRanking.pull
    );
    const fightIDs = this.retrieveFightIDs(currentBestPullRankings);

    if (fightIDs.length == 0) {
      return Promise.reject(`No rankings to retrieve for report ${reportCode}`);
    }

    logger.info(
      `Retrieving new rankings for pulls ${fightIDs} for report ${reportCode}`
    );

    let rankingsWrapper = null;
    try {
      rankingsWrapper = await this.fflogsClient.getSpeedRanking(
        reportCode,
        fightIDs
      );
    } catch (error) {
      return Promise.reject(error);
    }

    const rankings = rankingsWrapper.reportData.report.rankings.data;

    const rankingsPerEncounter = new Map();

    // Check if speed ranking exists for each fightID. If not
    // mark the encounter as untrackable
    fightIDs.forEach((fightID) => {
      if (
        rankings.find((ranking) => ranking.fightID && ranking.speed.rankPercent)
      ) {
        return;
      }
      const pull = bestPulls.find((pull) => pull.fightID === fightID);
      if (!pull) {
        return;
      }
      const encounterID = pull.encounterID;
      rankingsPerEncounter.set(
        encounterID,
        new BestPullRanking(pull, null, false)
      );
    });

    // Store retrieved rankings if present
    rankings
      .filter((ranking) => !isNaN(ranking.speed?.rankPercent))
      .forEach((ranking) => {
        const speedRanking = ranking.speed?.rankPercent || null;
        const currentPull = bestPulls.find(
          (pull) => pull.encounterID === ranking.encounter.id
        );
        if (currentPull) {
          rankingsPerEncounter.set(
            ranking.encounter.id,
            new BestPullRanking(currentPull, speedRanking)
          );
        }
      });

    return Promise.resolve(rankingsPerEncounter);
  }

  async buildNewReport(rawReport, reportCode, previousRankings) {
    const startInstant = Instant.ofEpochMilli(rawReport.startTime);
    const startTime = ZonedDateTime.ofInstant(
      startInstant,
      ZoneId.systemDefault()
    );
    const endInstant = Instant.ofEpochMilli(rawReport.endTime);
    const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault());

    const encounters = this.buildFights(rawReport);
    const bestPullRankings = await this.buildBestPullRankings(
      encounters,
      reportCode,
      previousRankings
    );

    const report = new Report(
      rawReport.title,
      startTime,
      endTime,
      encounters,
      rawReport.owner?.name,
      rawReport.guild?.name,
      bestPullRankings
    );
    return Promise.resolve(report);
  }

  buildFights(report) {
    const highDifficultyFights = getHighestDifficultyFights(report.fights);
    const sortedEncounters = sortEncountersByPullNumber(
      highDifficultyFights,
      this.maxEncounters || 1
    );

    const encounters = new Map();
    const killsAndWipes = getKillAndWipeNumbers(sortedEncounters);
    for (let [encounterID, rawPulls] of sortedEncounters.entries()) {
      if (!encounters.has(encounterID)) {
        encounters.set(encounterID, new Encounter());
      }
      rawPulls.forEach((rawPull, index) => {
        const encounterNumber = getPullNumber(
          killsAndWipes,
          index,
          encounterID
        );
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
          rawPull.fightNumber,
          rawPull.fight.name
        );
        encounters.get(encounterID).addFight(pull);
      });
    }
    const bestPullsPerEncounters = getBestPullPerEncounter(encounters);
    for (let encounterID of bestPullsPerEncounters.keys()) {
      encounters.get(encounterID).bestPull =
        bestPullsPerEncounters.get(encounterID);
    }

    return encounters;
  }
}

function getBestPullPerEncounter(encounters) {
  const bestPulls = new Map();
  for (let encounter of encounters.values()) {
    const bestPull = getBestPull(encounter.fights);
    bestPulls.set(bestPull.encounterID, bestPull);
  }

  return bestPulls;
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
    if (!pullsPerEncounters.has(encounter.encounterID)) {
      pullsPerEncounters.set(encounter.encounterID, []);
    }

    pullsPerEncounters.get(encounter.encounterID).push({
      fight: encounter,
      fightNumber: index + 1,
    });
  });

  const highestDifficultyEncounters = new Map();
  for (let [encounterID, encounters] of pullsPerEncounters.entries()) {
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

    if (!highestDifficultyEncounters.has(encounterID)) {
      highestDifficultyEncounters.set(encounterID, []);
    }
    highestDifficultyEncounters.set(
      encounterID,
      highestDifficultyEncounters.get(encounterID).concat(difficultEncounters)
    );
  }
  return highestDifficultyEncounters;
}

function sortEncountersByPullNumber(fights, maxEncounters) {
  const sortedFights = new Map();
  while (fights.size > 0 && sortedFights.size < maxEncounters) {
    const encounterID = getEncounterWithMostPulls(fights);
    sortedFights.set(encounterID, fights.get(encounterID));
    fights.delete(encounterID);
  }
  return sortedFights;
}

function getEncounterWithMostPulls(fights) {
  let encounterId = -1;
  let pullCount = -1;
  for (let [key, fight] of fights.entries()) {
    if (
      fight.length > pullCount ||
      (fight.length === pullCount && fight.encounterID > encounterId)
    ) {
      pullCount = fight.length;
      encounterId = key;
    }
  }
  return encounterId;
}

function getKillAndWipeNumbers(pulls) {
  const kills = new Map();
  const wipes = new Map();
  for (let [encounterID, encounters] of pulls.entries()) {
    if (!kills.has(encounterID)) {
      kills.set(encounterID, []);
    }
    if (!wipes.has(encounterID)) {
      wipes.set(encounterID, []);
    }
    encounters.forEach((encounter, index) => {
      if (encounter.fight.kill) {
        kills.get(encounterID).push(index + 1);
      } else {
        wipes.get(encounterID).push(index + 1);
      }
    });
  }

  return { kills, wipes };
}

function getPullNumber(killAndWipes, curIndex, encounterID) {
  let killOrWipeNumber = killAndWipes.wipes
    .get(encounterID)
    .indexOf(curIndex + 1);
  if (killOrWipeNumber === -1) {
    killOrWipeNumber = killAndWipes.kills
      .get(encounterID)
      .indexOf(curIndex + 1);
  }

  return killOrWipeNumber + 1;
}

export { ReportService };
