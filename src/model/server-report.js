export default class ServerReport {
  constructor(
    reportUrl,
    reportCode,
    endOfLife,
    endTime,
    embedMessage,
    channelId,
    reportHash,
    owner,
    bestPullRankings
  ) {
    this.reportUrl = reportUrl;
    this.reportCode = reportCode;
    this.endOfLife = endOfLife;
    this.reportEndTime = endTime;
    this.embedMessage = embedMessage;
    this.channelId = channelId;
    this.reportHash = reportHash;
    this.timeoutId = null;
    this.owner = owner;
    this.bestPullRankings = bestPullRankings;
    this.errorCount = 0;
  }
}
