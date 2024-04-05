import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { Duration, LocalDateTime, ZonedDateTime } from 'js-joda';
import { createEmbed } from './src/embeds.js';

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
  console.log(`Deleting report ${reportCode} from server ${serverId}`)
  clearInterval(reportPerServer[serverId].timeoutId);
  delete reportPerServer[serverId];
}

function updateReport(serverId){
  console.log(`Udpating report for server ${serverId}`)
  if(!reportPerServer.hasOwnProperty(serverId)){
    return;
  }

  const serverReport = reportPerServer[serverId]

  if(Duration.between(serverReport.lastUpdate, LocalDateTime.now()).seconds() > config.get('report_TTL')){
    deleteReport(serverId, serverReport.reportCode);
    return;
  }

  reportService.synthesize(serverReport.reportCode).then((report) => {
    try{
      sendReport(serverId, serverReport.reportCode, serverReport.embedMessage.channel, report, serverReport.reportUrl);
    } catch(error){
      console.error(error)
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
const matcher = new RegExp(/(https:\/\/www.fflogs.com\/reports\/([A-za-z0-9]+))#?/, "g");
const reportService = new ReportService(config.get("fflogs"))
reportService.init()

const reportPerServer = {}


parsingway.once(Events.ClientReady, () => {
  console.info(`Logged in as ${parsingway.user.tag}!`);
  parsingway.user.setPresence({activities: [{name : 'greeding that GCD', type: ActivityType.Competing}]})
});

parsingway.on(Events.MessageCreate, message => {
  if(message.author.id === parsingway.user.id){
    return
  }
  const serverId = message.guildId
  const channel = parsingway.channels.cache.get(message.channelId)
  if(!channel){
    return
  }
  
  let match = matcher.exec(message);
  if(!match){
    if(message.embeds.length === 0 || !message.embeds[0].data.url){
      return
    }
    match = matcher.exec(message.embeds[0].data.url)
    if(!match){
      return
    }
  }
  const reportUrl = match[1]
  const code = match[2];
  if (reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].timeoutId) {
    clearInterval(reportPerServer[serverId].timeoutId)
  }
  reportService.synthesize(code).then((report) => {
    const timeSinceLastReportUpdate = Duration.between(report.endTime, ZonedDateTime.now());
    const withAutoRefresh = timeSinceLastReportUpdate.seconds() < config.get("ignore_refresh_delay")
    console.info(`Auto refresh for report ${code} : ${withAutoRefresh}`)
    try{
      sendReport(serverId, code, channel, report, reportUrl, withAutoRefresh);
    } catch(error){
      console.error(error)
    }
  });
});


parsingway.login(token);