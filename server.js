import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/fflogs/report-service.js';
import { ZoneId, ZonedDateTime } from 'js-joda';
import { createEmbed } from './src/embeds-service.js';

const token = config.get('token')
const parsingway = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const matcher = new RegExp(/(https:\/\/www.fflogs.com\/reports\/([A-za-z0-9]+))#?/, "g");
const reportService = new ReportService(config.get("fflogs"))
reportService.init()

parsingway.once(Events.ClientReady, () => {
  console.log(`Logged in as ${parsingway.user.tag}!`);
});
parsingway.on(Events.MessageCreate, message => {
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
  reportService.synthesize(code).then((report) => {
    try{
      channel.send(createEmbed(report, reportUrl)), reason => console.error("Couldn't parse report")
    } catch(error){
      console.error(error)
    }
    
  });
  
});
parsingway.login(token);



