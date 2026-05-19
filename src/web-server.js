import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Duration, LocalDateTime } from "js-joda";
import logger from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes and starts the Web Server.
 * @param {Object} options
 * @param {number} options.port
 * @param {Map} options.reportsPerServer
 * @param {Function} options.deleteReport
 * @param {Function} options.updateReport
 * @param {HistoryService} options.historyService
 */
export function startWebServer({
  port,
  reportsPerServer,
  deleteReport,
  updateReport,
  historyService,
  activityTracker,
}) {
  const app = express();

  app.use(express.json());

  // Log API requests
  app.use((req, res, next) => {
    logger.debug(`Web API Request: ${req.method} ${req.url}`);
    next();
  });

  // Serve static files from src/web/public
  const publicPath = path.join(__dirname, "web", "public");
  app.use(express.static(publicPath));

  // Get currently tracked reports
  app.get("/api/reports", (req, res) => {
    try {
      const activeReports = Array.from(reportsPerServer.entries()).map(
        ([serverId, report]) => {
          let endOfLifeStr = "";
          let remainingSeconds = 0;
          try {
            if (report.endOfLife) {
              endOfLifeStr = report.endOfLife.toString();
              const now = LocalDateTime.now();
              remainingSeconds = Duration.between(now, report.endOfLife).seconds();
            }
          } catch (err) {
            logger.error(`Error calculating EOL for server ${serverId}: ${err.message}`);
          }

          return {
            serverId,
            reportCode: report.reportCode,
            reportUrl: report.reportUrl,
            owner: report.owner || "Unknown",
            channelId: report.channelId,
            endOfLife: endOfLifeStr,
            remainingSeconds: remainingSeconds > 0 ? remainingSeconds : 0,
            errorCount: report.errorCount || 0,
            thumbnailUrl: report.thumbnailUrl || "",
          };
        }
      );

      res.json(activeReports);
    } catch (error) {
      logger.error(`Error in GET /api/reports: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Stop tracking a report
  app.delete("/api/reports/:serverId", (req, res) => {
    const { serverId } = req.params;
    try {
      if (!reportsPerServer.has(serverId)) {
        return res.status(404).json({ error: "Report not found for this server" });
      }

      const deleted = deleteReport(serverId, true);
      if (deleted) {
        logger.info(`Web API: Stopped tracking report for server ${serverId}`);
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to delete report" });
      }
    } catch (error) {
      logger.error(`Error in DELETE /api/reports/${serverId}: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Manually refresh a report
  app.post("/api/reports/:serverId/refresh", async (req, res) => {
    const { serverId } = req.params;
    try {
      if (!reportsPerServer.has(serverId)) {
        return res.status(404).json({ error: "Report not found for this server" });
      }

      logger.info(`Web API: Triggering manual refresh for server ${serverId}`);
      const updated = await updateReport(serverId);
      res.json({ success: true, updated });
    } catch (error) {
      logger.error(`Error in POST /api/reports/${serverId}/refresh: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  // Get report history
  app.get("/api/history", (req, res) => {
    try {
      res.json(historyService.getHistory());
    } catch (error) {
      logger.error(`Error in GET /api/history: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Clear report history
  app.delete("/api/history/clear", (req, res) => {
    try {
      historyService.clearHistory();
      res.json({ success: true });
    } catch (error) {
      logger.error(`Error in DELETE /api/history/clear: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Get activity tracking diagnostics
  app.get("/api/activity", (req, res) => {
    try {
      if (activityTracker) {
        res.json(activityTracker.getStats());
      } else {
        res.status(501).json({ error: "Activity Tracking not enabled" });
      }
    } catch (error) {
      logger.error(`Error in GET /api/activity: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Fallback to index.html for UI routing
  app.use((req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  const server = app.listen(port, () => {
    logger.info(`Web Server started on port ${port}`);
  });

  return server;
}
