import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs-client.js";
import { LocalTime } from "js-joda";
import { DateTimeFormatter } from "js-joda";

const DURATION_FORMATTER = DateTimeFormatter.ofPattern('m:ss');

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
            data = await this.fflogsClient.getReport(reportCode);
        } catch(error){
            console.error(error);
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
        const pulls = report.fights.filter(fight => fight.difficulty === 100);
        const fights = {}
        pulls.forEach(element => {
            if(!fights.hasOwnProperty(element.name)){
                fights[element.name] = []
            }

            const duration = LocalTime.ofInstant(Instant.ofEpochMilli(element.endTime - element.startTime)).format(DURATION_FORMATTER)
            const pull = new Pull(element.bossPercentage, element.fightPercentage, element.kill, duration, element.lastPhase, fights[element.name].length + 1)
            fights[element.name].push(pull)
        });
        return fights;
    }
}

class Report{
    constructor(title, startTime, endTime, fights){
        this.title = title
        this.startTime = startTime
        this.endTime = endTime
        this.fights = fights
    }
    equals(otherReport){
        if(!otherReport || !otherReport.endTime){
            return false;
        }

        return this.endTime.equals(otherReport.endTime)
    }

}

class Pull{
    constructor(bossPercentage, fightPercentage, isKill, duration, lastPhase, number){
        this.bossPercentage = bossPercentage
        this.fightPercentage = fightPercentage
        this.kill = isKill
        this.duration = duration
        this.lastPhase = lastPhase
        this.number = number
    }
}
export {ReportService, Report, Pull}