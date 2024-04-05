import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { Duration, LocalDateTime, ZoneId, ZonedDateTime } from 'js-joda';
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
  console.log(`Logged in as ${parsingway.user.tag}!`);
});
parsingway.on(Events.MessageCreate, message => {
  const serverId = message.guildId

  
  const channel = parsingway.channels.cache.get(message.channelId)
  if(!channel){
    return;
  }
  
  const match = matcher.exec(message);
  if(!match){
    return;
  }
  const reportUrl = match[1]
  const code = match[2];
  if (reportPerServer.hasOwnProperty(serverId) && reportPerServer[serverId].timeoutId) {
    clearInterval(reportPerServer[serverId].timeoutId)
  }
  reportService.synthesize(code).then((report) => {
    try{
      sendReport(serverId, code, channel, report, reportUrl, true);
    } catch(error){
      console.error(error)
    }
  });
});


parsingway.login(token);