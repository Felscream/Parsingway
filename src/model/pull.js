export default class Pull {
  constructor(
    bossPercentage,
    fightPercentage,
    isKill,
    duration,
    lastPhase,
    killOrWipeNumber,
    encounterID,
    fightNumber,
    speedRanking
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
