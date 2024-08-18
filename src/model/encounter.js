export default class Encounter {
  constructor() {
    this.fights = [];
    this.ranking = null;
  }

  addFight(fight) {
    this.fights.push(fight);
  }
}
