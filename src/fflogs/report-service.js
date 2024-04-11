import { Duration, Instant, ZoneId, ZonedDateTime } from 'js-joda'
import FflogsClient from './fflogs-client.js'
import { LocalTime } from 'js-joda'
import objectHash from 'object-hash'

class ReportService {
  constructor (fflogsConfiguration, maxEncounters) {
    this.fflogsClient = new FflogsClient(fflogsConfiguration)
    this.reportsPerServers = {}
    this.maxEncounters = maxEncounters
  }

  async init () {
    await this.fflogsClient.init()
  }

  async synthesize (reportCode) {
    let data = null
    try {
      data = await this.fflogsClient.getReport(reportCode)
    } catch (error) {
      return Promise.reject(error)
    }

    return this.buildReport(data.reportData.report)
  }

  buildReport (rawReport) {
    const startInstant = Instant.ofEpochMilli(rawReport.startTime)
    const startTime = ZonedDateTime.ofInstant(
      startInstant,
      ZoneId.systemDefault()
    )
    const endInstant = Instant.ofEpochMilli(rawReport.endTime)
    const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault())
    const report = new Report(
      rawReport.title,
      startTime,
      endTime,
      this.buildFights(rawReport)
    )
    return new Promise((resolve, reject) => {
      resolve(report)
    })
  }

  buildFights (report) {
    const encounters = getHighestDifficultyFights(report.fights)
    const sortedEncounters = sortEncountersByPullNumber(
      encounters,
      this.maxEncounters || 1
    )

    const fights = {}
    const killsAndWipes = getKillAndWipeNumbers(sortedEncounters)
    for (let [name, rawPulls] of Object.entries(sortedEncounters)) {
      if (!fights.hasOwnProperty(name)) {
        fights[name] = []
      }
      rawPulls.forEach((rawPull, index) => {
        const encounterNumber = getPullNumber(killsAndWipes, index, name)
        const duration = LocalTime.ofInstant(
          Instant.ofEpochMilli(rawPull.fight.endTime - rawPull.fight.startTime),
          ZoneId.UTC
        )
        const pull = new Pull(
          rawPull.fight.bossPercentage,
          rawPull.fight.fightPercentage,
          rawPull.fight.kill,
          duration,
          rawPull.fight.lastPhase,
          encounterNumber,
          rawPull.fight.encounterID,
          rawPull.fightNumber
        )
        fights[name].push(pull)
      })
    }
    return fights
  }
}

function getHighestDifficultyFights (fights) {
  const pullsPerEncounters = {}
  fights.forEach((encounter, index) => {
    if (!pullsPerEncounters.hasOwnProperty(encounter.name)) {
      pullsPerEncounters[encounter.name] = []
    }

    pullsPerEncounters[encounter.name].push({
      fight: encounter,
      fightNumber: index + 1
    })
  })

  const highestDifficultyEncounters = {}
  for (let [encounterName, encounters] of Object.entries(pullsPerEncounters)) {
    let highestDifficulty = -1
    for (let encounter of encounters) {
      if (encounter.fight.difficulty > highestDifficulty) {
        highestDifficulty = encounter.fight.difficulty
      }
    }

    if (
      highestDifficulty === -1 ||
      (highestDifficulty !== 11 && highestDifficulty < 100)
    ) {
      continue
    }
    const difficultEncounters = encounters.filter(
      encounter =>
        encounter.fight.difficulty === highestDifficulty &&
        (highestDifficulty >= 100 || highestDifficulty === 11)
    )

    if (!highestDifficultyEncounters.hasOwnProperty(encounterName)) {
      highestDifficultyEncounters[encounterName] = []
    }
    highestDifficultyEncounters[encounterName] =
      highestDifficultyEncounters[encounterName].concat(difficultEncounters)
  }
  return highestDifficultyEncounters
}

function sortEncountersByPullNumber (fights, maxEncounters) {
  const sortedFights = {}
  while (
    Object.keys(fights).length > 0 &&
    Object.keys(sortedFights).length < maxEncounters
  ) {
    const encounter = getEncounterWithMostPulls(fights)
    sortedFights[encounter.name] = fights[encounter.name]
    delete fights[encounter.name]
  }
  return sortedFights
}

function getEncounterWithMostPulls (fights) {
  let encounterId = -1
  let pullCount = -1
  let encounterName = ''
  for (let [key, fight] of Object.entries(fights)) {
    if (fight.length > pullCount) {
      pullCount = fight.length
      encounterId = fight[0].fight.encounterID
      encounterName = key
    }
  }
  return { name: encounterName, id: encounterId }
}

function getKillAndWipeNumbers (pulls) {
  const kills = {}
  const wipes = {}
  for (let [name, encounters] of Object.entries(pulls)) {
    if (!kills.hasOwnProperty(name)) {
      kills[name] = []
    }
    if (!wipes.hasOwnProperty(name)) {
      wipes[name] = []
    }
    encounters.forEach((encounter, index) => {
      if (encounter.fight.kill) {
        kills[name].push(index + 1)
      } else {
        wipes[name].push(index + 1)
      }
    })
  }

  return { kills, wipes }
}

function getPullNumber (killAndWipes, curIndex, encounter) {
  let killOrWipeNumber = killAndWipes.wipes[encounter].indexOf(curIndex + 1)
  if (killOrWipeNumber === -1) {
    killOrWipeNumber = killAndWipes.kills[encounter].indexOf(curIndex + 1)
  }

  return killOrWipeNumber + 1
}

class Report {
  constructor (title, startTime, endTime, fights) {
    this.title = title
    this.startTime = startTime
    this.endTime = endTime
    this.fights = fights
  }

  getHash () {
    return objectHash.sha1(this, { excludeKeys: key => key === 'endTime' })
  }
}

class Pull {
  constructor (
    bossPercentage,
    fightPercentage,
    isKill,
    duration,
    lastPhase,
    killOrWipeNumber,
    encounterID,
    fightNumber
  ) {
    this.bossPercentage = bossPercentage
    this.fightPercentage = fightPercentage
    this.kill = isKill
    this.duration = duration
    this.lastPhase = lastPhase
    this.killOrWipeNumber = killOrWipeNumber
    this.encounterID = encounterID
    this.fightNumber = fightNumber
  }
}
export { ReportService, Report, Pull }
