import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { Duration, LocalDateTime, ZonedDateTime } from 'js-joda';
import { createEmbed } from './src/embeds.js';
import logger from "./logger.js"

function sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh = false, withAutoRefreshMessage = false, trackReport = false) {
  if (reportPerServer.hasOwnProperty(serverId)) {
    if(reportPerServer[serverId].reportCode === code){
      reportPerServer[serverId].embedMessage.delete();
    }
  }
  channel.send(createEmbed(report, reportUrl, withAutoRefreshMessage)).then(sentMessage => {
    if (reportPerServer.hasOwnProperty(serverId)) {
      reportPerServer[serverId].reportUrl = reportUrl;
      reportPerServer[serverId].report = report;
      reportPerServer[serverId].lastUpdate = LocalDateTime.now();
      reportPerServer[serverId].embedMessage = sentMessage;
      reportPerServer[serverId].reportCode = code;
      reportPerServer[serverId].channelId = channel.id;
    } else if(trackReport){
      reportPerServer[serverId] = new ServerReport(reportUrl, code, report, sentMessage, channel.id);
    }

    if(withAutoRefresh){
      reportPerServer[serverId].timeoutId = setInterval(updateReport, config.get('report_update_delay'), serverId)
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
  logger.info(`Udpating report ${serverReport.reportCode} for server ${serverId}`)
  if(Duration.between(serverReport.report.endTime, ZonedDateTime.now()).seconds() > config.get('report_TTL')){
    deleteReport(serverId);
    return;
  }

    reportService.synthesize(serverReport.reportCode).then(report => {
      try{
        sendReport(serverId, serverReport.reportCode, serverReport.embedMessage.channel, report, serverReport.reportUrl, false, true);
      } catch(error){
        logger.error(error)
        return
      }
    }, reject => {
      logger.error(reject)
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
  
  const channel = parsingway.channels.cache.get(message.channelId)
  if(!channel){
    return
  }
  
  const serverId = message.guildId
  const matcher = new RegExp(reportMatcher, "g");
  const match = matcher.exec(message.content);
  if(!match){
    if(message.embeds.length === 0 || !message.embeds[0].data.url){
      if(reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].channelId === message.channelId){
        deleteReport(serverId)
      }
      
      return
    }
    const embedMatch = matcher.exec(message.embeds[0].data.url)
    if(!embedMatch){
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
    const withAutoRefresh = timeSinceLastReportUpdate.seconds() < config.get("ignore_refresh_delay")
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
