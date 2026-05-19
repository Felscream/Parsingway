import logger from "../logger.js";

export class ActivityTracker {
  constructor() {
    this.requests = [];
    this.fetchTimes = [];
    this.responseTimes = [];
    this.serversServed = new Set();
    this.successCount = 0;
    this.failureCount = 0;
    this.cooldownBlocks = 0;
    this.startTime = Date.now();
    logger.info("ActivityTracker initialized");
  }

  /**
   * Records a request and logs the server ID.
   * @param {string} serverId 
   */
  trackRequest(serverId) {
    this.requests.push(Date.now());
    if (serverId) {
      this.serversServed.add(serverId.toString());
    }
  }

  /**
   * Records FF Logs data fetch duration.
   * @param {number} durationMs 
   */
  trackFetch(durationMs) {
    if (typeof durationMs === "number" && !isNaN(durationMs)) {
      this.fetchTimes.push(durationMs);
      if (this.fetchTimes.length > 200) {
        this.fetchTimes.shift();
      }
    }
  }

  /**
   * Records request processing/response duration.
   * @param {number} durationMs 
   */
  trackResponse(durationMs) {
    if (typeof durationMs === "number" && !isNaN(durationMs)) {
      this.responseTimes.push(durationMs);
      if (this.responseTimes.length > 200) {
        this.responseTimes.shift();
      }
    }
  }

  /**
   * Increments successful report operations.
   */
  trackSuccess() {
    this.successCount++;
  }

  /**
   * Increments failed report operations.
   */
  trackFailure() {
    this.failureCount++;
  }

  /**
   * Increments blocked request/update operations due to server cooldowns.
   */
  trackCooldownBlock() {
    this.cooldownBlocks++;
  }

  /**
   * Cleans up old request timestamps and returns formatted summary statistics.
   * @returns {Object}
   */
  getStats() {
    const oneHourAgo = Date.now() - 3600000;
    
    // Maintain rolling window for requests per hour
    this.requests = this.requests.filter((timestamp) => timestamp > oneHourAgo);

    const calcAvg = (arr) => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((acc, curr) => acc + curr, 0);
      return Math.round(sum / arr.length);
    };

    // Calculate memory heap usage in MB
    let heapMb = 0;
    try {
      heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    } catch (e) {
      logger.error(`Failed to read memory usage: ${e.message}`);
    }

    return {
      requestsPerHour: this.requests.length,
      avgFetchTimeMs: calcAvg(this.fetchTimes),
      avgResponseTimeMs: calcAvg(this.responseTimes),
      uniqueServersCount: this.serversServed.size,
      successCount: this.successCount,
      failureCount: this.failureCount,
      cooldownBlocks: this.cooldownBlocks,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryHeapUsedMb: heapMb,
      fetchHistory: this.fetchTimes.slice(-30),
      responseHistory: this.responseTimes.slice(-30),
    };
  }
}
