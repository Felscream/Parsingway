import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";
import config from "config";
import { ReportService } from "./src/fflogs/report-service.js";
import { Duration, LocalDateTime, ZonedDateTime } from "js-joda";
import {
  createEmbed,
  createSimpleEmbedWithMessage,
  removeFooter,
  createStatsEmbed,
} from "./src/embeds.js";
import logger from "./logger.js";
import ServerReport from "./src/model/server-report.js";
import CooldownService from "./src/cooldown-service.js";
import help from "./src/commands/utility/help.js";
import {
  ButtonStyles,
  ButtonTypes,
  pagination,
} from "@devraelfreeze/discordjs-pagination";

const REPORT_UPDATE_DELAY = config.get("report_update_delay"); // period between report updates
const REPORT_TTL = config.get("report_TTL"); // how long we are waiting for a change in the log report before we delete it
const OLD_REPORT_THESHOLD = config.get("old_report_threshold"); // how old should a report be before it is considered too old to be updated regularly
const MAX_SERVER_COUNT = config.get("max_servers"); // how many servers can have live logging
const CALL_COOLDOWN = config.get("call_cooldown");
const CALL_COUNT_ALERT_THRESHOLD = config.get("call_per_hour_alert_threshold");
const ADMIN_ID = config.get("admin_id");
const PRIVATE_REPORT_ERROR = "You do not have permission to view this report.";
const REPORT_DOES_NOT_EXIST = "This report does not exist.";

const reportService = new ReportService(
  config.get("fflogs"),
  config.get("max_encounters")
);

const cooldownService = new CooldownService(
  CALL_COOLDOWN,
  CALL_COUNT_ALERT_THRESHOLD
);

const reportMatcher =
  /(https:\/\/www.fflogs.com\/reports\/(?:compare\/)?([A-za-z0-9]{12,16}))[#/]?/;
reportService.init();

function registerCommands(client) {
  client.commands = new Map();
  client.commands.set(help.data.name, help);
}

function sendReport(
  serverId,
  code,
  channel,
  report,
  reportUrl,
  saveNewReport = false,
  withAutoRefreshMessage = false
) {
  if (
    reportsPerServer.has(serverId) &&
    reportsPerServer.get(serverId).embedMessage
  ) {
    const serverReport = reportsPerServer.get(serverId);
    let oldEmbed = serverReport.embedMessage.embeds[0];
    if (oldEmbed) {
      oldEmbed = removeFooter(oldEmbed);
      reportsPerServer
        .get(serverId)
        .embedMessage.edit({ embeds: [oldEmbed] })
        .catch((error) => {
          logger.error(
            `Error while editing message for report ${serverReport.reportCode} by ${serverReport.owner}`
          );
          logger.error(error);
        });
    }
  }

  const embed = createEmbed(report, code, reportUrl, withAutoRefreshMessage);
  channel
    .send({ embeds: [embed], flags: MessageFlags.SuppressNotifications })
    .then((message) => {
      if (saveNewReport) {
        addNewServerReport(serverId, reportUrl, code, report, channel, message);
      } else if (!canTrackReport(serverId)) {
        logger.warn(`Report ${code} will not be tracked`);
      }
    });
}

function addNewServerReport(
  serverId,
  reportUrl,
  code,
  report,
  channel,
  message
) {
  reportsPerServer.set(
    serverId,
    new ServerReport(
      reportUrl,
      code,
      getReportEndOfLife(),
      report.endTime,
      message,
      channel.id,
      report.getHash(),
      report.getOwner(),
      report.bestPullRankings
    )
  );

  reportsPerServer.get(serverId).timeoutId = setInterval(
    updateReport,
    REPORT_UPDATE_DELAY,
    serverId
  );
  logger.info(`Added report ${code} from ${serverId} to tracked reports`);
}

function getReportEndOfLife() {
  return LocalDateTime.now().plusSeconds(REPORT_TTL);
}

function updateServerReportData(report, serverId, reportUrl, code, channel) {
  return (sentMessage) => {
    if (!reportsPerServer.has(serverId)) {
      return;
    }
    setServerReportData(
      serverId,
      reportUrl,
      sentMessage,
      code,
      channel,
      report.getHash(),
      report.endTime,
      report.bestPullRankings
    );
  };
}

function setServerReportData(
  serverId,
  reportUrl,
  sentMessage,
  code,
  channel,
  reportHash,
  endTime,
  bestPullRankings
) {
  reportsPerServer.get(serverId).reportUrl = reportUrl;
  reportsPerServer.get(serverId).endOfLife = getReportEndOfLife();
  reportsPerServer.get(serverId).embedMessage = sentMessage;
  reportsPerServer.get(serverId).reportCode = code;
  reportsPerServer.get(serverId).channelId = channel.id;
  reportsPerServer.get(serverId).reportHash = reportHash;
  reportsPerServer.get(serverId).reportEndTime = endTime;
  reportsPerServer.get(serverId).bestPullRankings = bestPullRankings;
}

function deleteReport(serverId, updateMessage = false) {
  if (reportsPerServer.has(serverId)) {
    const serverReport = reportsPerServer.get(serverId);
    const reportCode = serverReport.reportCode;
    logger.info(
      `Deleting report ${reportCode} from server ${serverId} by ${serverReport.owner}`
    );
    clearInterval(serverReport.timeoutId);
    if (updateMessage) {
      let embed = serverReport.embedMessage?.embeds[0];
      if (embed) {
        embed = removeFooter(embed);

        serverReport.embedMessage.edit({ embeds: [embed] }).catch((error) => {
          logger.error(
            `Error while editing message for report ${serverReport.reportCode} by ${serverReport.owner}`
          );
          logger.error(error);
        });
      }
    }

    return reportsPerServer.delete(serverId);
  }
  return false;
}

function updateReport(serverId) {
  if (
    !reportsPerServer.has(serverId) ||
    !reportsPerServer.get(serverId).embedMessage
  ) {
    return;
  }

  if (cooldownService.canGetReport(serverId)) {
    cooldownService.registerServerCall(serverId);
  } else {
    logger.warn(`Blocked auto update from ${serverId}`);
    return;
  }

  const serverReport = reportsPerServer.get(serverId);
  const originalMessage = reportsPerServer.get(serverId).embedMessage;
  reportService
    .synthesizeReport(serverReport.reportCode, serverReport.bestPullRankings)
    .then(
      (newReport) => {
        const newReportHash = newReport.getHash();
        serverReport.errorCount = 0;
        if (newReportHash === serverReport.reportHash) {
          if (
            Duration.between(
              serverReport.endOfLife,
              ZonedDateTime.now()
            ).seconds() > 0
          ) {
            logger.info(
              `No changes detected for a long period on report ${serverReport.reportCode} by ${serverReport.owner} on server ${serverId}, it will be deleted`
            );
            deleteReport(serverId, true);
          }
          return;
        }

        logger.info(
          `Changes detected on report ${serverReport.reportCode} by ${serverReport.owner} on server ${serverId}, updating ...`
        );

        const embed = createEmbed(
          newReport,
          serverReport.reportCode,
          serverReport.reportUrl,
          true
        );

        originalMessage
          .edit({ embeds: [embed] })
          .then(
            updateServerReportData(
              newReport,
              serverId,
              serverReport.reportUrl,
              serverReport.reportCode,
              originalMessage.channel
            )
          )
          .catch((error) => {
            logger.error(
              `Error while editing message for report ${serverReport.reportCode} by ${serverReport.owner}. It will be deleted`
            );
            logger.error(error);
            deleteReport(serverId);
          });
      },
      (reject) => {
        logger.error(reject);
        if (serverReport.errorCount < 1) {
          handleReportRetrievalError(
            reject,
            serverReport.reportCode,
            serverReport.reportUrl,
            originalMessage.channel
          );
        }
        serverReport.errorCount++;
        if (serverReport.errorCount > 5) {
          deleteReport(serverId, true);
        }
      }
    );
}

function canTrackReport(serverId) {
  return (
    reportsPerServer.has(serverId) || reportsPerServer.size < MAX_SERVER_COUNT
  );
}

async function printCurrentReports(message) {
  const reports = reportsPerServer;
  for (let [
    serverId,
    lastCall,
  ] of cooldownService.lastCallPerServer.entries()) {
    if (reports.has(serverId)) {
      reports.get(serverId).lastCall = lastCall.lastCall;
    } else {
      reports.set(serverId, { lastCall: lastCall.lastCall });
    }
  }

  const embeds = createStatsEmbed(reports);
  await pagination({
    embeds: embeds /** Array of embeds objects */,
    message: message,
    author: message.author.id,
    ephemeral: true,
    time: 40000 /** 40 seconds */,
    disableButtons: false /** Remove buttons after timeout */,
    fastSkip: false,
    pageTravel: false,
    buttons: [
      {
        type: ButtonTypes.previous,
        label: "Previous Page",
        style: ButtonStyles.Primary,
      },
      {
        type: ButtonTypes.next,
        label: "Next Page",
        style: ButtonStyles.Success,
      },
    ],
  });
}

function stopPreviousReportUpdates(serverId) {
  const serverReport = reportsPerServer.get(serverId);
  logger.info(
    `Clearing previous report auto refresh for report ${serverReport.reportCode} by ${serverReport.owner} on server ${serverId}`
  );

  clearInterval(serverReport.timeoutId);
  let embed = serverReport.embedMessage?.embeds[0];
  if (embed) {
    embed = removeFooter(embed);

    serverReport.embedMessage.edit({ embeds: [embed] }).catch((error) => {
      logger.error(
        `Error while editing message for report ${serverReport.reportCode} by ${serverReport.owner}`
      );
      logger.error(error);
    });
  }
}

function removeAllReports() {
  logger.warn("All currently saved reports will be removed");
  let deletedReportCount = 0;
  const serverIds = reportsPerServer.keys();
  for (const serverId of serverIds) {
    const removed = deleteReport(serverId, true);
    if (removed) {
      deletedReportCount++;
    }
  }
  logger.info(`${deletedReportCount} reports were removed`);
}

function handleReportRetrievalError(reject, code, reportUrl, channel) {
  if (reject.err || !reject.response || !reject.response.errors) {
    logger.error(reject);
    return;
  }
  const errorMessage = reject.response?.errors[0].message;
  if (
    errorMessage === PRIVATE_REPORT_ERROR ||
    errorMessage === REPORT_DOES_NOT_EXIST
  ) {
    createErrorEmbed(code, reportUrl, channel);
  } else {
    logger.error(reject);
  }
}

function createErrorEmbed(code, reportUrl, channel) {
  logger.error(`Report ${code} can't be found or is private`);
  const embed = createSimpleEmbedWithMessage(
    reportUrl,
    "An error occured",
    `The report ${code} either does not exist or is private.`
  );
  channel.send({
    embeds: [embed],
    flags: MessageFlags.SuppressNotifications,
  });
}

const reportsPerServer = new Map();
const token = config.get("token");
const parsingway = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
registerCommands(parsingway);

parsingway.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${parsingway.user.tag}!`);
  parsingway.user.setPresence({
    activities: [{ name: "greeding that GCD", type: ActivityType.Competing }],
  });
});

parsingway.on(Events.MessageCreate, (message) => {
  if (message.author.id === parsingway.user.id) {
    return;
  }

  const channel = parsingway.channels.cache.get(message.channelId);
  if (!channel) {
    return;
  }

  if (message.author.id === ADMIN_ID) {
    if (message.content === "!stats") {
      printCurrentReports(message);
      return;
    }

    if (message.content === "!clearAll") {
      removeAllReports();
      return;
    }
  }

  const serverId = message.guildId;
  const matcher = new RegExp(reportMatcher, "g");
  let match = matcher.exec(message.content);
  if (!match) {
    if (message.embeds.length === 0 || !message.embeds[0].data.url) {
      return;
    }
    match = matcher.exec(message.embeds[0].data.url);
    if (!match) {
      return;
    }
  }

  if (cooldownService.canGetReport(serverId)) {
    cooldownService.registerServerCall(serverId);
  } else {
    logger.warn(`Blocked request from ${serverId}`);
    return;
  }

  const reportUrl = match[1].replace("compare/", "");
  const code = match[2];
  if (
    reportsPerServer.has(serverId) &&
    reportsPerServer.get(serverId).timeoutId
  ) {
    stopPreviousReportUpdates(serverId);
  }
  logger.info(`Received new report ${code} from ${serverId}`);
  reportService.synthesizeReport(code).then(
    (report) => {
      const timeSinceLastReportUpdate = Duration.between(
        report.endTime,
        ZonedDateTime.now()
      );
      const withAutoRefresh =
        timeSinceLastReportUpdate.seconds() < OLD_REPORT_THESHOLD;
      const saveNewReport = canTrackReport(serverId) && withAutoRefresh;
      try {
        sendReport(
          serverId,
          code,
          channel,
          report,
          reportUrl,
          saveNewReport,
          saveNewReport
        );
      } catch (error) {
        logger.error(error);
      }
    },
    (reject) => {
      //handleReportRetrievalError(reject, code, reportUrl, channel);
    }
  );
});

parsingway.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

parsingway.login(token);
