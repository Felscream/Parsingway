import { EmbedBuilder } from "discord.js";
import { DateTimeFormatter, Duration, LocalTime } from "js-joda";
import encounterThumbnails from "../resources/encounter_thumbail.json" assert { type: "json" };

const DURATION_FORMATTER = DateTimeFormatter.ofPattern("m:ss");
const TOTAL_DURATION_FORMATTER = DateTimeFormatter.ofPattern("H:mm:ss");
const KILL_COLOR = "#8df407";
const WIPE_COLOR = "#d8532b";
const MONSTER_EMOJI = "<:encounter:1226088953480740920>";
const BATTLE_EMOJI = "<:battle:1227231447664820305>";
const ANALYSIS_EMOJI = "<:analysis:1227772427845763173>";
const PLAY_DEAD_EMOJI = "<:playdead:1227921518487666718>";
const FFLOGS_EMOJI = "<:fflogs:1227922011322449920>";
const DEFAULT_THUMBNAIL_URL =
  "https://xivapi.com/img-misc/chat_messengericon_raids.png";
const XIV_ANALYSIS_URL = "https://xivanalysis.com/fflogs";
const EMPTY = "\u200B";
const SPACER = `${EMPTY} ${EMPTY} ${EMPTY} ${EMPTY}`;
const SERVERS_PER_PAGE = 25;

export function createEmbed(
  report,
  reportCode,
  reportUrl,
  withAutoRefreshMessage
) {
  const embed = new EmbedBuilder()
    .setTitle(report.title || "Report")
    .setColor(hasKillOnReport(report.encounters) ? KILL_COLOR : WIPE_COLOR)
    .setThumbnail(getThumbnail(report.encounters))
    .setURL(reportUrl)
    .addFields(
      {
        name: "Start",
        value: `<t:${report.startTime.toEpochSecond()}>`,
        inline: true,
      },
      {
        name: "End",
        value: `<t:${report.endTime.toEpochSecond()}>`,
        inline: true,
      }
    );
  if (withAutoRefreshMessage) {
    embed.setFooter({
      text: "This report is updated regularly.",
    });
  }

  if (report.encounters.size === 0) {
    embed.addFields({
      name: `No encounters detected yet`,
      value: "Come back later !",
    });
  } else {
    let fieldCount = 2;
    for (let [encounterName, encounter] of report.encounters.entries()) {
      if (fieldCount + 3 > 25) {
        return embed;
      }
      const bestPullRanking = encounter.rankings;

      embed.addFields(
        createEncounterTitle(encounterName, encounter),
        createBestPullField(bestPullRanking.pull)
      );
      if (bestPullRanking.pull.kill && bestPullRanking.ranking) {
        embed.addFields(createBestPullSpeedRanking(bestPullRanking));
      } else if (!bestPullRanking.pull.kill) {
        embed.addFields(getBestPullRemainingHP(bestPullRanking.pull));
      }
      embed.addFields(
        createBestPullLinks(reportUrl, reportCode, bestPullRanking.pull)
      );
      fieldCount += 3;
    }
  }
  return embed;
}

export function removeFooter(oldEmbed) {
  return EmbedBuilder.from(oldEmbed).setFooter(null);
}

export function createStatsEmbed(serverCalls) {
  const embeds = [];
  let counter = 0;
  let page = new EmbedBuilder()
    .setTitle("Usage")
    .setFooter({ text: `${serverCalls.size} tracked calls` });

  if (serverCalls.size === 0) {
    page.addFields({ name: "Nothing here", value: "¯_(ツ)_/¯" });
    embeds.push(page);
    return embeds;
  }

  for (let [serverId, call] of serverCalls.entries()) {
    const code = call.reportCode || "NA";
    const EOL = call.endOfLife
      ? call.endOfLife.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
      : "NA";
    const endTime = call.reportEndTime
      ? call.reportEndTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
      : "NA";
    const lastCall = call.lastCall?.format(
      DateTimeFormatter.ISO_LOCAL_DATE_TIME
    );
    page.addFields({
      name: `${serverId}`,
      value: `code : ${code} | EOL : ${EOL} | Report End Time : ${endTime} | Last call : ${lastCall}`,
    });

    if ((counter + 1) % SERVERS_PER_PAGE === 0) {
      embeds.push(page);
      page = new EmbedBuilder()
        .setTitle("Usage")
        .setFooter({ text: `${serverCalls.size} tracked calls` });
    }
    counter++;
  }

  if (counter !== 0 && (counter + 1) % SERVERS_PER_PAGE !== 0) {
    embeds.push(page);
  }

  return embeds;
}

function createBestPullLinks(reportUrl, reportCode, bestPull) {
  const bestPullUrl = buildBestPullUrl(reportUrl, bestPull);
  const bestPullAnalysisUrl = buildAnalysisUrl(reportCode, bestPull);
  return {
    name: "Links",
    value: `[${FFLOGS_EMOJI}](${bestPullUrl}) [${ANALYSIS_EMOJI}](${bestPullAnalysisUrl})`,
    inline: true,
  };
}

function createBestPullField(bestPull) {
  return {
    name: `Best ${bestPull.kill ? "kill" : "pull"}`,
    value: `**${bestPull.killOrWipeNumber}.** ${bestPull.duration.format(
      DURATION_FORMATTER
    )}`,
    inline: true,
  };
}

function createBestPullSpeedRanking(bestPull) {
  let rank = `Top ${100 - bestPull.ranking}%`;
  if (bestPull.ranking === 100) {
    rank = "1st";
  }
  return {
    name: "Speed ranking",
    value: rank,
    inline: true,
  };
}

function createEncounterTitle(encounterName, encounter) {
  const wipes = getWipes(encounter.fights);
  const totalDuration = getTotalDuration(encounter.fights);
  const killCount = encounter.fights.length - wipes;
  const killDisplay =
    killCount > 0 ? `${SPACER} ${BATTLE_EMOJI} ${killCount}` : "";
  const wipeDisplay = wipes > 0 ? `${SPACER} ${PLAY_DEAD_EMOJI} ${wipes}` : "";
  return {
    name: `${MONSTER_EMOJI} **${encounterName}**`,
    value: `*:stopwatch: ${totalDuration} ${killDisplay} ${wipeDisplay}*`,
  };
}

function buildPhaseText(bestPull) {
  if (bestPull.lastPhase !== 0 && !bestPull.kill) {
    return `P${bestPull.lastPhase} - `;
  }

  return "";
}

function getTotalDuration(fights) {
  const totalDuration = fights.reduce((acc, curr) => {
    return acc.plus(Duration.between(LocalTime.MIN, curr.duration));
  }, LocalTime.MIN);
  if (totalDuration.hour() > 0) {
    return totalDuration.format(TOTAL_DURATION_FORMATTER);
  }
  return totalDuration.format(DURATION_FORMATTER);
}

function getBestPullRemainingHP(bestPull) {
  const phase = buildPhaseText(bestPull);
  return {
    name: "Remaining health",
    value: `${phase}${bestPull.bossPercentage}%`,
    inline: true,
  };
}

function getWipes(pulls) {
  return pulls.filter((pull) => !pull.kill).length;
}

function hasKillOnReport(encounters) {
  for (let encounter of encounters.values()) {
    for (let i = 0; i < encounter.fights.length; i++) {
      if (encounter.fights[i].kill) {
        return true;
      }
    }
  }
  return false;
}

function getThumbnail(encounters) {
  if (encounters.size === 0) {
    return DEFAULT_THUMBNAIL_URL;
  }

  const fights = encounters.values().next().value.fights;
  const mostPlayedEncounterId = fights[0].encounterID;
  if (encounterThumbnails.hasOwnProperty(mostPlayedEncounterId)) {
    return encounterThumbnails[mostPlayedEncounterId].thumbnail;
  }
  return DEFAULT_THUMBNAIL_URL;
}

function buildAnalysisUrl(reportCode, bestPull) {
  const url = new URL(XIV_ANALYSIS_URL);
  url.pathname = `fflogs/${reportCode}/${bestPull.fightNumber}`;
  return url.href;
}

function buildBestPullUrl(reportUrl, bestPull) {
  return reportUrl + `#fight=${bestPull.fightNumber}`;
}
