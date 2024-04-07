import { EmbedBuilder } from "discord.js";
import { DateTimeFormatter } from "js-joda";
import encounterThumbnails from "../resources/encounter_thumbail.json" assert {type: 'json'}
import { getEncounterWithMostPulls } from "./fflogs/report-service.js";

const TIME_FORMATTER = DateTimeFormatter.ofPattern('dd/MM/yyyy HH:mm');
const DURATION_FORMATTER = DateTimeFormatter.ofPattern('m:ss');
const empty = '\u200B';
const KILL_COLOR = "#95ed5e"
const WIPE_COLOR = "#d8532b"
const monsterEmoji = "<:encounter:1226088953480740920>"
const defaultThumbnailUrl = "https://xivapi.com/img-misc/chat_messengericon_raids.png";

export function createEmbed(report, reportUrl, withAutoRefreshMessage){
    const embed = new EmbedBuilder()
    .setTitle(report.title || "Report")
    .setColor(hasKillOnReport(report.fights) ? KILL_COLOR : WIPE_COLOR)
    .setThumbnail(getThumbnail(report.fights))
    .setURL(reportUrl)
    .addFields(
        {name : 'Start', value:report.startTime.format(TIME_FORMATTER), inline: true},
        {name : 'End', value:report.endTime.format(TIME_FORMATTER), inline: true}
    )
    if(withAutoRefreshMessage){
        embed.setFooter({
            text: 'This report is updated every minute. Sending a new report on this server, or a new message on this channel will stop it.'
        })
    } else {
        embed.setFooter({
            text: 'This report will not be updated.'
        })
    }
    if(Object.entries(report.fights).length === 0){
        embed.addFields({name : `No encounter detected yet`, value : "Come back later !"})
    } else {
        let fieldCount = 2
        for (let [key, fights] of Object.entries(report.fights)){
            if(fieldCount + 3 > 25){
                return {embeds: [embed]}
            }
            const bestPull = getBestPull(fights)
            const phase = bestPull.lastPhase !== 0 && !bestPull.kill ? `P${bestPull.lastPhase} ` : ''
            const percentage = getBestPullInfo(bestPull, fights)
            const wipes = getWipes(fights)
            embed.addFields(
                {name : `${monsterEmoji}** ${key}**`, value : `*${fights.length > 1 ? 'pulls' : 'pull'} *`},
                {name: `Best ${bestPull.kill ? 'kill' : 'pull'}`, value:`**${bestPull.number}.** ${bestPull.duration.format(DURATION_FORMATTER)} - ${phase}${percentage}`, inline: true},
                {name: "Wipes", value: `${wipes}`, inline:true},
            )
            fieldCount += 3
        }
    }
    return {embeds: [embed]}
}

function getBestPull(pulls){
    return pulls.reduce((prev, curr) => {
        if(!prev.kill && curr.kill){
            return curr
        }

        if(prev.kill && !curr.kill){
            return prev
        }

        if(prev.kill && curr.kill && prev.duration > curr.duration){
            return curr;
        }

        if(prev.kill && curr.kill && prev.duration < curr.duration){
            return prev;
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

function getThumbnail(fights){
    const mostPlayedEncounterId = getEncounterWithMostPulls(fights).id
    if(encounterThumbnails.hasOwnProperty(mostPlayedEncounterId)){
        return encounterThumbnails[mostPlayedEncounterId].thumbnail
    }
    return defaultThumbnailUrl
}