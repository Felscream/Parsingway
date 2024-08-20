import objectHash from "object-hash";

export default class BestPullRanking {
  constructor(pull, ranking) {
    this.pull = pull;
    this.ranking = ranking;
  }

  getHash() {
    return objectHash(this);
  }
}
