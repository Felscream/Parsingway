import objectHash from "object-hash";

export default class Report {
  constructor(title, startTime, endTime, encounters, owner, guild, rankings) {
    this.title = title;
    this.startTime = startTime;
    this.endTime = endTime;
    this.encounters = encounters;
    this.owner = owner;
    this.guild = guild;
    this.bestPullRankings = rankings;
  }

  getHash() {
    return objectHash(this, {
      excludeKeys: function (key) {
        return key === "endTime";
      },
    });
  }

  getOwner() {
    if (this.guild) {
      return this.guild;
    }
    return this.owner;
  }
}
