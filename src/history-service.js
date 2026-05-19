import logger from "../logger.js";

const MAX_HISTORY_ITEMS = 500;

export class HistoryService {
  constructor() {
    this.records = [];
  }

  /**
   * Adds a record to the in-memory history.
   * @param {string} reportCode 
   * @param {string} reportUrl 
   * @param {string} owner 
   * @param {string} serverId 
   * @param {string} channelId 
   */
  addRecord(reportCode, reportUrl, owner, serverId, channelId, thumbnailUrl) {
    // Avoid duplicate entries if they are submitted close to each other
    const isDuplicate = this.records.some(
      (r) => r.reportCode === reportCode && r.serverId === serverId
    );
    if (isDuplicate) {
      // Move to top of history, or just skip adding to avoid duplication
      this.records = this.records.filter(
        (r) => !(r.reportCode === reportCode && r.serverId === serverId)
      );
    }

    const newRecord = {
      reportCode,
      reportUrl,
      owner: owner || "Unknown",
      serverId: serverId || "Unknown",
      channelId: channelId || "Unknown",
      thumbnailUrl: thumbnailUrl || "",
      receivedAt: new Date().toISOString(),
    };

    this.records.unshift(newRecord); // newest first

    if (this.records.length > MAX_HISTORY_ITEMS) {
      this.records = this.records.slice(0, MAX_HISTORY_ITEMS);
    }

    logger.debug(`HistoryService: Added report ${reportCode} from server ${serverId} to memory history`);
  }

  /**
   * Returns all stored records.
   * @returns {Array}
   */
  getHistory() {
    return this.records;
  }

  /**
   * Clears the in-memory history.
   */
  clearHistory() {
    this.records = [];
    logger.info("HistoryService: Cleared report history");
  }
}
