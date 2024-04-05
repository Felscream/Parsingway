import { EmbedBuilder } from "discord.js";
import { DateTimeFormatter } from "js-joda";

const TIME_FORMATTER = DateTimeFormatter.ofPattern('dd/MM/yyyy HH:mm');
const empty = '\u200B';
export function createEmbed(report, reportUrl){
    const embed = new EmbedBuilder()
    .setTitle(report.title)
    .setThumbnail("https://xivapi.com/img-misc/chat_messengericon_raids.png")
    .setURL(reportUrl)
    .addFields(
        {name : 'Start', value:report.startTime.format(TIME_FORMATTER), inline: true},
        {name : 'End', value:report.endTime.format(TIME_FORMATTER), inline: true}
    )
    for (let [key, fights] of Object.entries(report.fights)){
        const bestPull = getBestPull(fights)
        const phase = bestPull.lastPhase !== 0 ? `P${bestPull.lastPhase} ` : ''
        const percentage = bestPull.kill ? "Killed" : `${bestPull.bossPercentage}%`
        const wipes = getWipes(fights)
        embed.addFields(
            {name : `**${key}**`, value : empty},
            {name: "Best pull", value:`**${bestPull.number}.** ${phase}${percentage}`, inline: true},
            {name: "Wipes", value: `${wipes}`, inline:true},

        )
    }
    return {embeds: [embed]}
}

function getBestPull(pulls){
    return pulls.reduce((prev, curr) => {
        if(prev.fightPercentage > curr.fightPercentage){
            return curr;
        }
        return prev;
    })
}

function getWipes(pulls){
    return pulls.filter(pull => !pull.kill).length
}