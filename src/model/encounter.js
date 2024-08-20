export default class Encounter {
  constructor() {
    this.fights = [];
    this.bestPull = null;
  }

  addFight(fight) {
    this.fights.push(fight);
  }
}
