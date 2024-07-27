import { Embed, EmbedBuilder } from "discord.js";
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
    .setColor(hasKillOnReport(report.fights) ? KILL_COLOR : WIPE_COLOR)
    .setThumbnail(getThumbnail(report.fights))
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
      text: "This report is updated every minute.",
    });
  } else {
    embed.setFooter({
      text: "This report will not be updated.",
    });
  }

  if (report.fights.size === 0) {
    embed.addFields({
      name: `No encounters detected yet`,
      value: "Come back later !",
    });
  } else {
    let fieldCount = 2;
    for (let [encounterName, fights] of report.fights.entries()) {
      if (fieldCount + 3 > 25) {
        return { embeds: [embed] };
      }
      const bestPull = getBestPull(fights);

      embed.addFields(
        createEncounterTitle(encounterName, fights),
        createBestPullField(bestPull),
        createBestPullLinks(reportUrl, reportCode, bestPull)
      );
      fieldCount += 3;
    }
  }
  return embed;
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
  const phase = buildPhaseText(bestPull);
  const percentage = getBestPullInfo(bestPull);
  return {
    name: `Best ${bestPull.kill ? "kill" : "pull"}`,
    value: `**${bestPull.killOrWipeNumber}.** ${bestPull.duration.format(
      DURATION_FORMATTER
    )} ${phase}${percentage}`,
    inline: true,
  };
}

function createEncounterTitle(encounterName, fights) {
  const wipes = getWipes(fights);
  const totalDuration = getTotalDuration(fights);
  const killCount = fights.length - wipes;
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
    return `- P${bestPull.lastPhase} `;
  }
  if (!bestPull.kill) {
    return "- ";
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

function getBestPull(pulls) {
  return pulls.reduce((prev, curr) => {
    if (!prev.kill && curr.kill) {
      return curr;
    }

    if (prev.kill && !curr.kill) {
      return prev;
    }

    if (prev.kill && curr.kill && prev.duration > curr.duration) {
      return curr;
    }

    if (prev.kill && curr.kill && prev.duration < curr.duration) {
      return prev;
    }

    if (prev.fightPercentage > curr.fightPercentage) {
      return curr;
    }
    return prev;
  });
}

function getBestPullInfo(bestPull) {
  if (!bestPull.kill) {
    return `${bestPull.bossPercentage}%`;
  }
  return "";
}

function getWipes(pulls) {
  return pulls.filter((pull) => !pull.kill).length;
}

function hasKillOnReport(encounters) {
  for (let fight of encounters.values()) {
    for (let i = 0; i < fight.length; i++) {
      if (fight[i].kill) {
        return true;
      }
    }
  }
  return false;
}

function getThumbnail(fights) {
  if (fights.size === 0) {
    return DEFAULT_THUMBNAIL_URL;
  }
  const mostPlayedEncounterId = fights.values().next().value[0].encounterID;
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
