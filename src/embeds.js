import { EmbedBuilder } from 'discord.js'
import { DateTimeFormatter, Duration, LocalTime } from 'js-joda'
import encounterThumbnails from '../resources/encounter_thumbail.json' assert { type: 'json' }

const DURATION_FORMATTER = DateTimeFormatter.ofPattern('m:ss')
const TOTAL_DURATION_FORMATTER = DateTimeFormatter.ofPattern('H:mm:ss')
const KILL_COLOR = '#8df407'
const WIPE_COLOR = '#d8532b'
const MONSTER_EMOJI = '<:encounter:1226088953480740920>'
const BATTLE_EMOJI = '<:battle:1227231447664820305>'
const ANALYSIS_EMOJI = '<:analysis:1227772427845763173>'
const PLAY_DEAD_EMOJI = '<:playdead:1227921518487666718>'
const FFLOGS_EMOJI = '<:fflogs:1227922011322449920>'
const DEFAULT_THUMBNAIL_URL =
  'https://xivapi.com/img-misc/chat_messengericon_raids.png'
const XIV_ANALYSIS_URL = 'https://xivanalysis.com/fflogs'
const EMPTY = '\u200B'
const SPACER = `${EMPTY} ${EMPTY} ${EMPTY} ${EMPTY}`

export function createEmbed (
  report,
  reportCode,
  reportUrl,
  withAutoRefreshMessage
) {
  const embed = new EmbedBuilder()
    .setTitle(report.title || 'Report')
    .setColor(hasKillOnReport(report.fights) ? KILL_COLOR : WIPE_COLOR)
    .setThumbnail(getThumbnail(report.fights))
    .setURL(reportUrl)
    .addFields(
      {
        name: 'Start',
        value: `<t:${report.startTime.toEpochSecond()}>`,
        inline: true
      },
      {
        name: 'End',
        value: `<t:${report.endTime.toEpochSecond()}>`,
        inline: true
      }
    )
  if (withAutoRefreshMessage) {
    embed.setFooter({
      text: 'This report is updated every minute.'
    })
  } else {
    embed.setFooter({
      text: 'This report will not be updated.'
    })
  }

  if (Object.entries(report.fights).length === 0) {
    embed.addFields({
      name: `No encounters detected yet`,
      value: 'Come back later !'
    })
  } else {
    let fieldCount = 2
    for (let [key, fights] of Object.entries(report.fights)) {
      if (fieldCount + 3 > 25) {
        return { embeds: [embed] }
      }
      const bestPull = getBestPull(fights)
      const bestPullUrl = buildBestPullUrl(reportUrl, bestPull)
      const bestPullAnalysisUrl = buildAnalysisUrl(reportCode, bestPull)
      const phase = buildPhaseText(bestPull)
      const percentage = getBestPullInfo(bestPull, fights)
      const wipes = getWipes(fights)
      const totalDuration = getTotalDuration(fights)
      embed.addFields(
        {
          name: `${MONSTER_EMOJI} **${key}**`,
          value: `*:stopwatch: ${totalDuration} ${SPACER} ${BATTLE_EMOJI} ${fights.length} ${SPACER} ${PLAY_DEAD_EMOJI} ${wipes}*`
        },
        {
          name: `Best ${bestPull.kill ? 'kill' : 'pull'}`,
          value: `**[${
            bestPull.killOrWipeNumber
          }.](${bestPullUrl})** ${bestPull.duration.format(
            DURATION_FORMATTER
          )} ${phase}${percentage}`,
          inline: true
        },
        {
          name: 'Links',
          value: `[${FFLOGS_EMOJI}](${bestPullUrl}) [${ANALYSIS_EMOJI}](${bestPullAnalysisUrl})`,
          inline: true
        }
      )
      fieldCount += 3
    }
  }
  return embed
}

function buildPhaseText (bestPull) {
  if (bestPull.lastPhase !== 0 && !bestPull.kill) {
    return `- P${bestPull.lastPhase} `
  }
  if (!bestPull.kill) {
    return '- '
  }

  return ''
}

function getTotalDuration (fights) {
  const totalDuration = fights.reduce((acc, curr) => {
    return acc.plus(Duration.between(LocalTime.MIN, curr.duration))
  }, LocalTime.MIN)
  if (totalDuration.hour() > 0) {
    return totalDuration.format(TOTAL_DURATION_FORMATTER)
  }
  return totalDuration.format(DURATION_FORMATTER)
}

function getBestPull (pulls) {
  return pulls.reduce((prev, curr) => {
    if (!prev.kill && curr.kill) {
      return curr
    }

    if (prev.kill && !curr.kill) {
      return prev
    }

    if (prev.kill && curr.kill && prev.duration > curr.duration) {
      return curr
    }

    if (prev.kill && curr.kill && prev.duration < curr.duration) {
      return prev
    }

    if (prev.fightPercentage > curr.fightPercentage) {
      return curr
    }
    return prev
  })
}

function getBestPullInfo (bestPull, pulls) {
  if (!bestPull.kill) {
    return `${bestPull.bossPercentage}%`
  }
  return ''
}

function getWipes (pulls) {
  return pulls.filter(pull => !pull.kill).length
}

function hasKillOnReport (fights) {
  for (let [key, fight] of Object.entries(fights)) {
    for (let i = 0; i < fight.length; i++) {
      if (fight[i].kill) {
        return true
      }
    }
  }
  return false
}

function getThumbnail (fights) {
  if (Object.keys(fights).length === 0) {
    return DEFAULT_THUMBNAIL_URL
  }
  const mostPlayedEncounterId = fights[Object.keys(fights)[0]][0].encounterID
  if (encounterThumbnails.hasOwnProperty(mostPlayedEncounterId)) {
    return encounterThumbnails[mostPlayedEncounterId].thumbnail
  }
  return DEFAULT_THUMBNAIL_URL
}

function buildAnalysisUrl (reportCode, bestPull) {
  const url = new URL(XIV_ANALYSIS_URL)
  url.pathname = `fflogs/${reportCode}/${bestPull.fightNumber}`
  return url.href
}

function buildBestPullUrl (reportUrl, bestPull) {
  return reportUrl + `#fight=${bestPull.fightNumber}`
}
