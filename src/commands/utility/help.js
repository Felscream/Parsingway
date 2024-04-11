import { SlashCommandBuilder } from 'discord.js'
const help = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Quick explanation on how to interact with Parsingway')

export default {
  data: help,
  async execute (interaction) {
    await interaction.reply({
      content:
        'Send an FFLogs report link in a discord channel to generate a summary',
      ephemeral: true
    })
  }
}
