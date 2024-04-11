import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags
} from 'discord.js'
import config from 'config'
import { ReportService } from './src/fflogs/report-service.js'
import { Duration, LocalDateTime, ZonedDateTime } from 'js-joda'
import { createEmbed } from './src/embeds.js'
import logger from './logger.js'
import ServerReport from './src/server-report.js'
import CooldownService from './src/cooldown-service.js'
import help from './src/commands/utility/help.js'

const REPORT_UPDATE_DELAY = config.get('report_update_delay') // period between report updates
const REPORT_TTL = config.get('report_TTL') // how long we are waiting for a change in the log report before we delete it
const OLD_REPORT_THESHOLD = config.get('old_report_threshold') // how old should a report be before it is considered too old to be updated regularly
const MAX_SERVER_COUNT = config.get('max_servers') // how many servers can have live logging
const CALL_COOLDOWN = config.get('call_cooldown')
const CALL_COUNT_ALERT_THRESHOLD = config.get('call_per_hour_alert_threshold')

const reportService = new ReportService(
  config.get('fflogs'),
  config.get('max_encounters')
)

const cooldownService = new CooldownService(
  CALL_COOLDOWN,
  CALL_COUNT_ALERT_THRESHOLD
)

const reportMatcher =
  /(https:\/\/www.fflogs.com\/reports\/(?:compare\/)?([A-za-z0-9]{12,16}))[#/]?/
reportService.init()

function registerCommands (client) {
  client.commands = new Map()
  client.commands.set(help.data.name, help)
}

function sendReport (
  serverId,
  code,
  channel,
  report,
  reportUrl,
  saveNewReport = false,
  withAutoRefreshMessage = false
) {
  if (reportPerServer.hasOwnProperty(serverId)) {
    if (
      reportPerServer.get(serverId).reportCode === code &&
      reportPerServer.get(serverId).channelId === channel.id
    ) {
      reportPerServer.get(serverId).embedMessage.delete()
    }
  }
  const embed = createEmbed(report, code, reportUrl, withAutoRefreshMessage)
  channel
    .send({ embeds: [embed], flags: MessageFlags.SuppressNotifications })
    .then(
      setServerReport(report, serverId, reportUrl, code, channel, saveNewReport)
    )
}

function setServerReport (
  report,
  serverId,
  reportUrl,
  code,
  channel,
  saveNewReport
) {
  return sentMessage => {
    const reportHash = report.getHash()
    const reportEndOfLife = LocalDateTime.now().plusSeconds(REPORT_TTL)
    if (reportPerServer.hasOwnProperty(serverId)) {
      updateServerReport(
        serverId,
        reportUrl,
        reportEndOfLife,
        sentMessage,
        code,
        channel,
        reportHash,
        report
      )
      return
    }
    if (saveNewReport) {
      reportPerServer.set(
        serverId,
        new ServerReport(
          reportUrl,
          code,
          reportEndOfLife,
          report.endTime,
          sentMessage,
          channel.id,
          reportHash
        )
      )
      reportPerServer.get(serverId).timeoutId = setInterval(
        updateReport,
        REPORT_UPDATE_DELAY,
        serverId
      )
      logger.info(`Added report ${code} from ${serverId} to tracked reports`)
    } else if (!canTrackReport(serverId)) {
      logger.warn('Cannot track more reports')
    }
  }
}

function updateServerReport (
  serverId,
  reportUrl,
  reportEndOfLife,
  sentMessage,
  code,
  channel,
  reportHash,
  report
) {
  const serverReport = reportPerServer.get(serverId)
  serverReport.reportUrl = reportUrl
  serverReport.endOfLife = reportEndOfLife
  serverReport.embedMessage = sentMessage
  serverReport.reportCode = code
  serverReport.channelId = channel.id
  serverReport.reportHash = reportHash
  serverReport.reportEndTime = report.endTime
}

function deleteReport (serverId) {
  if (reportPerServer.has(serverId)) {
    const serverReport = reportPerServer.get(serverId)
    const reportCode = serverReport.reportCode
    logger.info(`Deleting report ${reportCode} from server ${serverId}`)
    clearInterval(serverReport.timeoutId)
    reportPerServer.delete(serverId)
  }
}

function updateReport (serverId) {
  if (!reportPerServer.has(serverId)) {
    return
  }

  if (cooldownService.canGetReport(serverId)) {
    cooldownService.registerServerCall(serverId)
  } else {
    logger.warn(`Blocked auto update from ${serverId}`)
    return
  }

  const serverReport = reportPerServer.get(serverId)

  reportService.synthesize(serverReport.reportCode).then(
    newReport => {
      const newReportHash = newReport.getHash()
      if (newReportHash === serverReport.reportHash) {
        logger.info(
          `Report ${serverReport.reportCode} from server ${serverId} has not changed, no update required`
        )
        if (
          Duration.between(
            serverReport.endOfLife,
            ZonedDateTime.now()
          ).seconds() > 0
        ) {
          logger.info(
            `No changes detected for a long period on report ${serverReport.reportCode} from server ${serverId}, it will be deleted`
          )
          deleteReport(serverId)
        }
        return
      }

      logger.info(
        `Changes detected on report ${serverReport.reportCode} from server ${serverId}, updating ...`
      )

      try {
        sendReport(
          serverId,
          serverReport.reportCode,
          serverReport.embedMessage.channel,
          newReport,
          serverReport.reportUrl,
          false,
          true
        )
      } catch (error) {
        logger.error(error)
        return
      }
    },
    reject => {
      logger.error(reject)
    }
  )
}

function canTrackReport (serverId) {
  return (
    reportPerServer.hasOwnProperty(serverId) ||
    Object.keys(reportPerServer).length < MAX_SERVER_COUNT
  )
}

const reportPerServer = new Map()
const token = config.get('token')
const parsingway = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})
registerCommands(parsingway)

parsingway.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${parsingway.user.tag}!`)
  parsingway.user.setPresence({
    activities: [{ name: 'greeding that GCD', type: ActivityType.Competing }]
  })
})

parsingway.on(Events.MessageCreate, message => {
  if (message.author.id === parsingway.user.id) {
    return
  }

  const channel = parsingway.channels.cache.get(message.channelId)
  if (!channel) {
    return
  }

  const serverId = message.guildId
  const matcher = new RegExp(reportMatcher, 'g')
  let match = matcher.exec(message.content)
  if (!match) {
    if (message.embeds.length === 0 || !message.embeds[0].data.url) {
      if (
        reportPerServer.has(serverId) &&
        reportPerServer.get(serverId).channelId === message.channelId
      ) {
        deleteReport(serverId)
      }
      return
    }
    match = matcher.exec(message.embeds[0].data.url)
    if (!match) {
      if (
        reportPerServer.has(serverId) &&
        reportPerServer.get(serverId).channelId === message.channelId
      ) {
        deleteReport(serverId)
      }
      return
    }
  }

  if (cooldownService.canGetReport(serverId)) {
    cooldownService.registerServerCall(serverId)
  } else {
    logger.warn(`Blocked request from ${serverId}`)
    return
  }

  const reportUrl = match[1].replace('compare/', '')
  const code = match[2]
  if (
    reportPerServer.has(serverId) &&
    reportPerServer.get(serverId).timeoutId
  ) {
    logger.info(
      `Clearing previous report auto refresh for report ${
        reportPerServer.get(serverId).reportCode
      } on server ${serverId}`
    )
    clearInterval(reportPerServer.get(serverId).timeoutId)
  }
  logger.info(`Received new report ${code} from ${serverId}`)
  reportService.synthesize(code).then(
    report => {
      const timeSinceLastReportUpdate = Duration.between(
        report.endTime,
        ZonedDateTime.now()
      )
      const withAutoRefresh =
        timeSinceLastReportUpdate.seconds() < OLD_REPORT_THESHOLD
      const saveNewReport = canTrackReport(serverId) && withAutoRefresh
      logger.info(`Auto refresh for report ${code} : ${withAutoRefresh}`)
      try {
        sendReport(
          serverId,
          code,
          channel,
          report,
          reportUrl,
          saveNewReport,
          saveNewReport
        )
      } catch (error) {
        logger.error(error)
      }
    },
    reject => {
      logger.error(reject)
    }
  )
})

parsingway.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return
  const command = interaction.client.commands.get(interaction.commandName)
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(error)
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true
      })
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true
      })
    }
  }
})

parsingway.login(token)
