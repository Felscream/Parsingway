import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs-client.js";
import { LocalTime } from "js-joda";
import objectHash from "object-hash";

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

    return this.buildReport(data.reportData.report);
  }

  buildReport(rawReport) {
    const startInstant = Instant.ofEpochMilli(rawReport.startTime);
    const startTime = ZonedDateTime.ofInstant(
      startInstant,
      ZoneId.systemDefault()
    );
    const endInstant = Instant.ofEpochMilli(rawReport.endTime);
    const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault());
    const report = new Report(
      rawReport.title,
      startTime,
      endTime,
      this.buildFights(rawReport)
    );
    return new Promise((resolve, reject) => {
      resolve(report);
    });
  }

  buildFights(report) {
    const encounters = getHighestDifficultyFights(report.fights);
    const sortedEncounters = sortEncountersByPullNumber(
      encounters,
      this.maxEncounters || 1
    );

    const fights = new Map();
    const killsAndWipes = getKillAndWipeNumbers(sortedEncounters);
    for (let [name, rawPulls] of sortedEncounters.entries()) {
      if (!fights.has(name)) {
        fights.set(name, []);
      }
      rawPulls.forEach((rawPull, index) => {
        const encounterNumber = getPullNumber(killsAndWipes, index, name);
        const duration = LocalTime.ofInstant(
          Instant.ofEpochMilli(rawPull.fight.endTime - rawPull.fight.startTime),
          ZoneId.UTC
        );
        const pull = new Pull(
          rawPull.fight.bossPercentage,
          rawPull.fight.fightPercentage,
          rawPull.fight.kill,
          duration,
          rawPull.fight.lastPhase,
          encounterNumber,
          rawPull.fight.encounterID,
          rawPull.fightNumber,
          findPullSpeedRanking(rawPull, report.rankings.data)
        );
        fights.get(name).push(pull);
      });
    }
    return fights;
  }
}

function findPullSpeedRanking(rawPull, rankings) {
  const rank = rankings.find((el) => el.fightID === rawPull.fight.id);
  if (rank === undefined) {
    return null;
  }
  return isNaN(rank.speed?.rankPercent) ? null : rank.speed.rankPercent;
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
    if (fight.length > pullCount) {
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

class Report {
  constructor(title, startTime, endTime, fights) {
    this.title = title;
    this.startTime = startTime;
    this.endTime = endTime;
    this.fights = fights;
  }

  getHash() {
    return objectHash.sha1(this, { excludeKeys: (key) => key === "endTime" });
  }
}

class Pull {
  constructor(
    bossPercentage,
    fightPercentage,
    isKill,
    duration,
    lastPhase,
    killOrWipeNumber,
    encounterID,
    fightNumber,
    speedRanking,
    remainingHealth
  ) {
    this.bossPercentage = bossPercentage;
    this.fightPercentage = fightPercentage;
    this.kill = isKill;
    this.duration = duration;
    this.lastPhase = lastPhase;
    this.killOrWipeNumber = killOrWipeNumber;
    this.encounterID = encounterID;
    this.fightNumber = fightNumber;
    this.speedRanking = speedRanking;
  }
}
export { ReportService, Report, Pull };
