import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs-client.js";
import { LocalTime } from "js-joda";
import logger from "../../logger.js";



class ReportService{
    constructor(fflogsConfiguration){
        this.fflogsClient = new FflogsClient(fflogsConfiguration)
        this.reportsPerServers = {}
    }

    async init(){
        await this.fflogsClient.init()
    }

    async synthesize(reportCode){
        let data = null
        try{
            data  = await this.fflogsClient.getReport(reportCode);
        } catch(error){
            return Promise.reject(error)
        }
        
        
        return this.buildReport(data)
    }

    buildReport(data){
        if(data == null){
            return new Promise((resolve, reject) =>{
                reject(null)
            })
        }
        const rawReport = data.reportData.report;
        
        const startInstant = Instant.ofEpochMilli(rawReport.startTime);
        const startTime = ZonedDateTime.ofInstant(startInstant, ZoneId.systemDefault())
        const endInstant = Instant.ofEpochMilli(rawReport.endTime);
        const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault())
        const report = new Report(rawReport.title, startTime, endTime, this.buildFights(rawReport))
        return new Promise((resolve, reject) => {
            resolve(report)
        })
    }

    buildFights(report){
        const pulls = report.fights.filter(fight => fight.difficulty >= 100);
        const fights = {}
        const killsAndWipes = getKillAndWipeNumbers(pulls)
        pulls.forEach((element, index) => {
            if(!fights.hasOwnProperty(element.name)){
                fights[element.name] = []
            }
            const encounterNumber = getPullNumber(killsAndWipes, index, element.name)
            const duration = LocalTime.ofInstant(Instant.ofEpochMilli(element.endTime - element.startTime))
            const durationSeconds = Duration.between(Instant.ofEpochMilli(element.startTime), Instant.ofEpochMilli(element.endTime)).seconds()
            const pull = new Pull(element.bossPercentage, element.fightPercentage, element.kill, duration, element.lastPhase, encounterNumber, durationSeconds, element.encounterID)
            fights[element.name].push(pull)
        });
        return fights;
    }
}

function getKillAndWipeNumbers(pulls){
    const kills = {}
    const wipes = {}
    for (let i = 0; i < pulls.length; i++){
        const pull = pulls[i]
        if(!kills.hasOwnProperty(pull.name)){
            kills[pull.name] = []
        }
        if(!wipes.hasOwnProperty(pull.name)){
            wipes[pull.name] = []
        }
        if(pulls[i].kill){
            kills[pull.name].push(i+1)
        } else{
            wipes[pull.name].push(i+1)
        }
    }
    return {kills, wipes}
}

function getPullNumber(killAndWipes, curIndex, encounter){
    let number = killAndWipes.wipes[encounter].indexOf(curIndex+1)
    if(number === -1){
        number = killAndWipes.kills[encounter].indexOf(curIndex+1)
    }

    return number + 1
}

class Report{
    constructor(title, startTime, endTime, fights){
        this.title = title
        this.startTime = startTime
        this.endTime = endTime
        this.fights = fights
    }

}

class Pull{
    constructor(bossPercentage, fightPercentage, isKill, duration, lastPhase, number, seconds, encounterId){
        this.bossPercentage = bossPercentage
        this.fightPercentage = fightPercentage
        this.kill = isKill
        this.duration = duration
        this.durationSeconds = seconds
        this.lastPhase = lastPhase
        this.number = number
        this.encounterId = encounterId
    }
}
export {ReportService, Report, Pull}