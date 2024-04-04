import { REST, Routes } from 'discord.js';
import config from 'config';

const clientID = config.get('client_id');
const token = config.get('token');
const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

try {
  console.log('Started refreshing application (/) commands.');

  await rest.put(Routes.applicationCommands(clientID), { body: [] });

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}