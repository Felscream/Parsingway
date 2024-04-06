import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { DateTimeFormatter } from "js-joda";

const TIME_FORMATTER = DateTimeFormatter.ofPattern('dd/MM/yyyy HH:mm');
const DURATION_FORMATTER = DateTimeFormatter.ofPattern('m:ss');
const empty = '\u200B';
const KILL_COLOR = "#95ed5e"
const WIPE_COLOR = "#d8532b"

export function createEmbed(report, reportUrl){
    const embed = new EmbedBuilder()
    .setTitle(report.title || "Report")
    .setColor(hasKillOnReport(report.fights) ? KILL_COLOR : WIPE_COLOR)
    .setThumbnail("https://xivapi.com/img-misc/chat_messengericon_raids.png")
    .setURL(reportUrl)
    .addFields(
        {name : 'Start', value:report.startTime.format(TIME_FORMATTER), inline: true},
        {name : 'End', value:report.endTime.format(TIME_FORMATTER), inline: true}
    )
    if(Object.entries(report.fights).length === 0){
        embed.addFields({name : `No encounter detected yet`, value : "Come back later !"})
    } else {
        let fieldCount = 2
        for (let [key, fights] of Object.entries(report.fights)){
            if(fieldCount + 3 > 25){
                return {embeds: [embed]}
            }
            const bestPull = getBestPull(fights)
            const phase = bestPull.lastPhase !== 0 ? `P${bestPull.lastPhase} ` : ''
            const percentage = getBestPullInfo(bestPull, fights)
            const wipes = getWipes(fights)
            embed.addFields(
                {name : `<:encounter:1226088953480740920>** ${key}**`, value : empty},
                {name: "Best pull", value:`**${bestPull.number}.** ${bestPull.duration.format(DURATION_FORMATTER)} - ${phase}${percentage}`, inline: true},
                {name: "Wipes", value: `${wipes}`, inline:true},
            )
            fieldCount += 3
        }
    }
    return {embeds: [embed]}
}

function getBestPull(pulls){
    return pulls.reduce((prev, curr) => {
        if(prev.kill && curr.kill && prev.duration > curr.duration){
            return curr;
        }
        if(prev.fightPercentage > curr.fightPercentage){
            return curr;
        }
        return prev;
    })
}

function getKills(pulls){
    return pulls.filter(pull => pull.kill).length
}

function getBestPullInfo(bestPull, pulls){
    if(!bestPull.kill){
        return `${bestPull.bossPercentage}%`
    }
    const kills = getKills(pulls)
    return `${kills} kill${kills > 1 ? 's':''}`
}

function getWipes(pulls){
    return pulls.filter(pull => !pull.kill).length
}

function hasKillOnReport(fights){
    for (let [key, fight] of Object.entries(fights)){
        for (let i = 0; i < fight.length; i++){
            if(fight[i].kill){
                return true
            }
        }
    }
    return false
}