import objectHash from "object-hash";

export default class Report {
  constructor(title, startTime, endTime, encounters, owner, guild) {
    this.title = title;
    this.startTime = startTime;
    this.endTime = endTime;
    this.encounters = encounters;
    this.owner = owner;
    this.guild = guild;
  }

  getHash() {
    return objectHash.sha1(this, { excludeKeys: (key) => key === "endTime" });
  }

  getOwner() {
    if (this.guild) {
      return this.guild;
    }
    return this.owner;
  }
}
