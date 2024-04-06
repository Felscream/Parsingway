import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { Duration, LocalDateTime, ZonedDateTime } from 'js-joda';
import { createEmbed } from './src/embeds.js';
import logger from "./logger.js"

function sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh = false) {
  if (reportPerServer.hasOwnProperty(serverId)) {
    if(reportPerServer[serverId].reportCode === code){
      reportPerServer[serverId].embedMessage.delete();
    }
  }
  channel.send(createEmbed(report, reportUrl)).then(sentMessage => {
    if (reportPerServer.hasOwnProperty(serverId)) {
      reportPerServer[serverId].reportUrl = reportUrl;
      reportPerServer[serverId].report = report;
      reportPerServer[serverId].lastUpdate = LocalDateTime.now();
      reportPerServer[serverId].embedMessage = sentMessage;
      reportPerServer[serverId].reportCode = code;
      reportPerServer[serverId].channelId = channel.id;
    } else {
      reportPerServer[serverId] = new ServerReport(reportUrl, code, report, sentMessage, channel.id);
    }

    if(withAutoRefresh){
      reportPerServer[serverId].timeoutId = setInterval(updateReport, config.get('report_update_delay'), serverId)
    }
  });
}

function deleteReport(serverId, reportCode) {
  logger.info(`Deleting report ${reportCode} from server ${serverId}`)
  clearInterval(reportPerServer[serverId].timeoutId);
  delete reportPerServer[serverId];
}

function updateReport(serverId){
  
  if(!reportPerServer.hasOwnProperty(serverId)){
    return;
  }

  const serverReport = reportPerServer[serverId]
  logger.info(`Udpating report ${serverReport.reportCode} for server ${serverId}`)
  if(Duration.between(serverReport.report.endTime, ZonedDateTime.now()).seconds() > config.get('report_TTL')){
    deleteReport(serverId, serverReport.reportCode);
    return;
  }

  reportService.synthesize(serverReport.reportCode).then((report) => {
    try{
      sendReport(serverId, serverReport.reportCode, serverReport.embedMessage.channel, report, serverReport.reportUrl);
    } catch(error){
      logger.error(error)
    }
  });
}

class ServerReport{
  constructor(reportUrl, reportCode, report, embedMessage, channelId){
    this.reportUrl = reportUrl
    this.reportCode = reportCode
    this.report = report
    this.lastUpdate = LocalDateTime.now()
    this.embedMessage = embedMessage
    this.channelId = channelId
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
  const serverId = message.guildId
  const channel = parsingway.channels.cache.get(message.channelId)
  if(!channel){
    return
  }
  
  const matcher = new RegExp(reportMatcher, "g");
  const match = matcher.exec(message.content);
  if(!match){
    if(message.embeds.length === 0 || !message.embeds[0].data.url){
      return
    }
    const embedMatch = matcher.exec(message.embeds[0].data.url)
    if(!embedMatch){
      return
    }
  }
  const reportUrl = match[1]
  const code = match[2];
  if (reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].timeoutId) {
    logger.info(`Clearing previous report auto refresh for report ${reportPerServer[serverId].reportCode} on server ${serverId}`)
    clearInterval(reportPerServer[serverId].timeoutId)
  }
  logger.info(`Received new report ${code}`)
  reportService.synthesize(code).then((report) => {
    const timeSinceLastReportUpdate = Duration.between(report.endTime, ZonedDateTime.now());
    const withAutoRefresh = timeSinceLastReportUpdate.seconds() < config.get("ignore_refresh_delay")
    logger.info(`Auto refresh for report ${code} : ${withAutoRefresh}`)
    try{
      sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh);
    } catch(error){
      logger.error(error)
    }
  });
});


parsingway.login(token);
