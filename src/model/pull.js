export default class Pull {
  constructor(
    fightID,
    bossPercentage,
    fightPercentage,
    isKill,
    duration,
    lastPhase,
    killOrWipeNumber,
    encounterID,
    fightNumber,
    bossName
  ) {
    this.fightID = fightID;
    this.bossPercentage = bossPercentage;
    this.fightPercentage = fightPercentage;
    this.kill = isKill;
    this.duration = duration;
    this.lastPhase = lastPhase;
    this.killOrWipeNumber = killOrWipeNumber;
    this.encounterID = encounterID;
    this.fightNumber = fightNumber;
    this.bossName = bossName;
  }
}
