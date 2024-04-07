import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { Duration, LocalDateTime, ZonedDateTime } from 'js-joda';
import { createEmbed } from './src/embeds.js';
import logger from "./logger.js"

const REPORT_UPDATE_DELAY = config.get('report_update_delay'); // period between report updates
const REPORT_TTL = config.get('report_TTL'); // how long we are waiting for a change in the log report before we delete it
const OLD_REPORT_THESHOLD = config.get('old_report_threshold'); // how old should a report be before it is considered too old to be updated regularly

function sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh = false, withAutoRefreshMessage = false, trackReport = false) {
  if (reportPerServer.hasOwnProperty(serverId)) {
    if(reportPerServer[serverId].reportCode === code && reportPerServer[serverId].channelId === channel.id){
      reportPerServer[serverId].embedMessage.delete()
    }
  }
  channel.send(createEmbed(report, reportUrl, withAutoRefreshMessage)).then(sentMessage => {
    const reportHash = report.getHash()
    const reportEndOfLife = LocalDateTime.now().plusSeconds(REPORT_TTL)
    if (reportPerServer.hasOwnProperty(serverId)) {
      reportPerServer[serverId].reportUrl = reportUrl
      reportPerServer[serverId].endOfLife = reportEndOfLife
      reportPerServer[serverId].embedMessage = sentMessage
      reportPerServer[serverId].reportCode = code
      reportPerServer[serverId].channelId = channel.id
      reportPerServer[serverId].reportHash = reportHash
      reportPerServer[serverId].reportEndTime = report.endTime
    } else if(trackReport){
      reportPerServer[serverId] = new ServerReport(reportUrl, code, reportEndOfLife, report.endTime, sentMessage, channel.id,reportHash)
    }

    if(withAutoRefresh){
      reportPerServer[serverId].timeoutId = setInterval(updateReport, REPORT_UPDATE_DELAY, serverId)
    }
  });
}

function deleteReport(serverId) {
  if(reportPerServer.hasOwnProperty(serverId)){
    const reportCode = reportPerServer[serverId].reportCode
    logger.info(`Deleting report ${reportCode} from server ${serverId}`)
    clearInterval(reportPerServer[serverId].timeoutId);
    delete reportPerServer[serverId];
  }
}


function updateReport(serverId){
  if(!reportPerServer.hasOwnProperty(serverId)){
    return;
  }

  const serverReport = reportPerServer[serverId]

  reportService.synthesize(serverReport.reportCode).then(newReport => {
    const newReportHash = newReport.getHash();
    if(newReportHash === serverReport.reportHash){
      logger.info(`Report ${serverReport.reportCode} from server ${serverId} has not changed, no update required`)
      if(Duration.between(serverReport.endOfLife, ZonedDateTime.now()).seconds() > 0){
        logger.info(`No changes detected for a long period on report ${serverReport.reportCode} from server ${serverId}, it will be deleted`)
        deleteReport(serverId);
      }
      return
    }

    logger.info(`Changes detected on report ${serverReport.reportCode} from server ${serverId}, updating ...`)

    try{
      sendReport(serverId, serverReport.reportCode, serverReport.embedMessage.channel, newReport, serverReport.reportUrl, false, true);
    } catch(error){
      logger.error(error)
      return
    }
  }, reject => {
    logger.error(reject)
  });
  
}

class ServerReport{
  constructor(reportUrl, reportCode, endOfLife, endTime, embedMessage, channelId, reportHash){
    this.reportUrl = reportUrl
    this.reportCode = reportCode
    this.endOfLife = endOfLife
    this.reportEndTime = endTime
    this.embedMessage = embedMessage
    this.channelId = channelId
    this.reportHash = reportHash
    this.timeoutId = null
  }
}

const token = config.get('token')
const parsingway = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const reportService = new ReportService(config.get("fflogs"))
reportService.init()

const reportPerServer = {}


parsingway.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${parsingway.user.tag}!`);
  parsingway.user.setPresence({activities: [{name : 'greeding that GCD', type: ActivityType.Competing}]})
});

const reportMatcher = /(https:\/\/www.fflogs.com\/reports\/([A-za-z0-9]+))#?/;
parsingway.on(Events.MessageCreate, message => {
  if(message.author.id === parsingway.user.id){
    return
  }
  
  const channel = parsingway.channels.cache.get(message.channelId)
  if(!channel){
    return
  }
  
  const serverId = message.guildId
  const matcher = new RegExp(reportMatcher, "g");
  let match = matcher.exec(message.content);
  if(!match){
    if(message.embeds.length === 0 || !message.embeds[0].data.url){
      if(reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].channelId === message.channelId){
        deleteReport(serverId)
      }
      return
    }
    match = matcher.exec(message.embeds[0].data.url)
    if(!match){
      if(reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].channelId === message.channelId){
        deleteReport(serverId)
      }
      return
    }
  }
  const reportUrl = match[1]
  const code = match[2];
  if (reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].timeoutId) {
    logger.info(`Clearing previous report auto refresh for report ${reportPerServer[serverId].reportCode} on server ${serverId}`)
    clearInterval(reportPerServer[serverId].timeoutId)
  }
  logger.info(`Received new report ${code} from ${serverId}`)
  reportService.synthesize(code).then((report) => {
    const timeSinceLastReportUpdate = Duration.between(report.endTime, ZonedDateTime.now());
    const withAutoRefresh = timeSinceLastReportUpdate.seconds() < OLD_REPORT_THESHOLD
    logger.info(`Auto refresh for report ${code} : ${withAutoRefresh}`)
    try{
      sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh, withAutoRefresh, withAutoRefresh);
    } catch(error){
      logger.error(error)
    }
  }, reject =>{
    logger.error(reject)
  });
});


parsingway.login(token);
