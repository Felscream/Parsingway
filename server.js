import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';
import {ReportService} from './src/report-service.js';
import { ZoneId, ZonedDateTime } from 'js-joda';

const token = config.get('token')
const parsingway = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const matcher = new RegExp(/fflogs.com\/reports\/([A-za-z0-9]+)#?/, "g");
const reportService = new ReportService(config.get("fflogs"))
reportService.init()

parsingway.on(Events.ClientReady, () => {
  console.log(`Logged in as ${parsingway.user.tag}!`);
});
console.log(ZoneId.systemDefault().normalized())
parsingway.on(Events.MessageCreate, message => {
  const match = matcher.exec(message);
  if(match){
    const code = match[1];
    const report = reportService.synthesize(code);
  }

});

parsingway.login(token);



