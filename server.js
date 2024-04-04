import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from 'config';

const token = config.get('token')
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });


client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, message => console.log(message.content));
client.login(token);



